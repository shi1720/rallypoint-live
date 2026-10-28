import { Timestamp } from "firebase-admin/firestore";
import { createState, publicState, transition } from "../rally/engine";
import type { Action, RallyState, Transition } from "../rally/types";
import { store, docId, expiry, encodeState, decodeState } from "./store";
import { HttpError, randomToken } from "./security";
export async function getRoom(
  ownerId: string,
  creator = "Your community",
): Promise<RallyState> {
  const db = store(),
    ref = db.collection("rooms").doc(ownerId);
  return db.runTransaction(async (tx) => {
    const row = await tx.get(ref);
    if (row.exists) return decodeState(row.get("body"));
    const initial = createState({
      id: crypto.randomUUID(),
      publicId: randomToken(18),
      creator,
    });
    tx.create(ref, {
      owner_id: ownerId,
      public_id: initial.publicId,
      revision: 0,
      body: encodeState(initial),
      updated_at: initial.updatedAt,
    });
    tx.create(db.collection("publicRooms").doc(initial.publicId), {
      owner_id: ownerId,
      state: { ...publicState(initial), chatReady: false },
    });
    return initial;
  });
}
export async function findPublic(id: string): Promise<RallyState | null> {
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(id)) return null;
  const snap = await store().collection("publicRooms").doc(id).get();
  return snap.exists ? (snap.get("state") as RallyState) : null;
}
export async function mutateRoom(
  ownerId: string,
  action: Action,
  outbound?: { id: string; parentId?: string },
): Promise<Transition> {
  await getRoom(ownerId);
  const db = store(),
    ref = db.collection("rooms").doc(ownerId);
  return db.runTransaction(
    async (tx) => {
      const row = await tx.get(ref);
      if (!row.exists) throw new HttpError(404, "Studio not found.");
      const old = decodeState(row.get("body"));
      const receiptRef = outbound
        ? db.collection("receipts").doc(docId(ownerId + ":" + outbound.id))
        : null;
      if (receiptRef) {
        const existing = await tx.get(receiptRef);
        if (existing.exists) return { state: old, changed: false };
      }
      const connection = await tx.get(
        db.collection("integrations").doc(ownerId),
      );
      let result: Transition;
      try {
        result = transition(old, action);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid action.";
        throw new HttpError(
          /changed|conflict|refresh/i.test(message) ? 409 : 400,
          message,
        );
      }
      if (!result.changed) {
        if (receiptRef)
          tx.create(receiptRef, {
            owner_id: ownerId,
            expiresAt: expiry(),
            created_at: Timestamp.now(),
          });
        return result;
      }
      result.state.revision = old.revision + 1;
      tx.update(ref, {
        body: encodeState(result.state),
        revision: result.state.revision,
        updated_at: result.state.updatedAt,
      });
      tx.set(db.collection("publicRooms").doc(result.state.publicId), {
        owner_id: ownerId,
        state: {
          ...publicState(result.state),
          chatReady:
            connection.exists && connection.get("status") === "connected",
        },
      });
      if (receiptRef && outbound) {
        tx.create(receiptRef, {
          owner_id: ownerId,
          expiresAt: expiry(),
          created_at: Timestamp.now(),
        });
        if (result.reply)
          tx.create(
            db.collection("outbox").doc(docId(ownerId + ":" + outbound.id)),
            {
              id: outbound.id,
              eventId: outbound.id,
              owner_id: ownerId,
              reply: result.reply,
              parent_id: outbound.parentId ?? null,
              status: "pending",
              created_at: new Date().toISOString(),
              expiresAt: expiry(),
              public_id: old.publicId,
              brief_version: old.brief.version,
              brief_expires_at: old.brief.expiresAt,
            },
          );
      }
      return result;
    },
    { maxAttempts: 6 },
  );
}
export async function lookupOwner(broadcasterId: string) {
  const doc = await store()
    .collection("channels")
    .doc(docId(broadcasterId))
    .get();
  return doc.exists ? { owner_id: doc.get("owner_id") as string } : null;
}
export async function recordOpen(publicId: string, visitorKey: string) {
  const db = store(),
    pub = db.collection("publicRooms").doc(publicId),
    open = db
      .collection("opens")
      .doc(
        docId(
          publicId +
            ":" +
            visitorKey +
            ":" +
            new Date().toISOString().slice(0, 10),
        ),
      );
  return db.runTransaction(async (tx) => {
    const [view, receipt] = await Promise.all([tx.get(pub), tx.get(open)]);
    if (!view.exists) throw new HttpError(404, "Page not found.");
    if (receipt.exists) return false;
    const privateRef = db.collection("rooms").doc(view.get("owner_id"));
    const privateSnap = await tx.get(privateRef);
    if (!privateSnap.exists) throw new HttpError(404, "Studio not found.");
    const result = transition(decodeState(privateSnap.get("body")), {
      type: "open",
    });
    tx.update(privateRef, {
      body: encodeState(result.state),
      revision: result.state.revision,
      updated_at: result.state.updatedAt,
    });
    tx.update(pub, {
      state: {
        ...publicState(result.state),
        chatReady: view.get("state").chatReady ?? false,
      },
    });
    tx.create(open, { expiresAt: expiry(), created_at: Timestamp.now() });
    return true;
  });
}
