import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./firebase";
import type { RallyState } from "../rally/types";
import { HttpError } from "./security";
export function store() {
  return firestore();
}
export function docId(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function expiry(hours = 24) {
  return Timestamp.fromMillis(Date.now() + hours * 3600000);
}
export function encodeState(state: RallyState) {
  const raw = Buffer.from(JSON.stringify(state));
  if (raw.length > 4 * 1024 * 1024)
    throw new HttpError(
      409,
      "This session is full. Export it and start a new session.",
    );
  const body = gzipSync(raw);
  if (body.length > 900 * 1024)
    throw new HttpError(
      409,
      "This session is full. Export it and start a new session.",
    );
  return body;
}
export function decodeState(value: unknown): RallyState {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array))
    throw new Error("Invalid session encoding.");
  return JSON.parse(
    gunzipSync(value, { maxOutputLength: 4 * 1024 * 1024 }).toString("utf8"),
  );
}
export async function updateIntegrationError(ownerId: string, error: string) {
  const ref = store().collection("integrations").doc(ownerId);
  await store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const room = await tx.get(store().collection("rooms").doc(ownerId));
    if (room.exists)
      tx.update(store().collection("publicRooms").doc(room.get("public_id")), {
        "state.chatReady": false,
      });
    if (snap.exists)
      tx.update(ref, {
        status: "error",
        error,
        updated_at: new Date().toISOString(),
      });
  });
}
