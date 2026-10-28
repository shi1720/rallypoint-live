import { createState, transition } from "../rally/engine";
import type { Action, RallyState, Transition } from "../rally/types";
import { runtime } from "./env";
import { HttpError, randomToken } from "./security";
type Row = {
  id: string;
  owner_id: string;
  public_id: string;
  revision: number;
  state: string;
  updated_at: string;
};
export async function getRoom(
  ownerId: string,
  creator = "Creator",
): Promise<RallyState> {
  const db = runtime().DB;
  let row = await db
    .prepare("SELECT * FROM rooms WHERE owner_id=?")
    .bind(ownerId)
    .first<Row>();
  if (!row) {
    const initial = createState({
      id: crypto.randomUUID(),
      publicId: randomToken(18),
      creator,
    });
    await db
      .prepare(
        "INSERT OR IGNORE INTO rooms (id,owner_id,public_id,revision,state,updated_at) VALUES (?,?,?,?,?,?)",
      )
      .bind(
        initial.id,
        ownerId,
        initial.publicId,
        initial.revision,
        JSON.stringify(initial),
        initial.updatedAt,
      )
      .run();
    row = await db
      .prepare("SELECT * FROM rooms WHERE owner_id=?")
      .bind(ownerId)
      .first<Row>();
  }
  if (!row) throw new HttpError(503, "Unable to open the studio.");
  return JSON.parse(row.state);
}
export async function findPublic(id: string): Promise<RallyState | null> {
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(id)) return null;
  const row = await runtime()
    .DB.prepare("SELECT state FROM rooms WHERE public_id=?")
    .bind(id)
    .first<{ state: string }>();
  return row ? JSON.parse(row.state) : null;
}
export async function mutateRoom(
  ownerId: string,
  action: Action,
  outbound?: { id: string; parentId?: string },
): Promise<Transition> {
  const db = runtime().DB;
  for (let attempt = 0; attempt < 6; attempt++) {
    const old = await getRoom(ownerId);
    if (
      outbound &&
      (await db
        .prepare("SELECT id FROM event_receipts WHERE id=?")
        .bind(outbound.id)
        .first())
    )
      return { state: old, changed: false };
    let result: Transition;
    try {
      result = transition(old, action);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid action.";
      throw new HttpError(
        /changed|conflict/i.test(message) ? 409 : 400,
        message,
      );
    }
    if (!result.changed) return result;
    result.state.revision = old.revision + 1;
    const update = db.prepare(
      "UPDATE rooms SET state=?,revision=?,updated_at=? WHERE owner_id=? AND revision=?" +
        (outbound
          ? " AND NOT EXISTS (SELECT 1 FROM event_receipts WHERE id=?)"
          : ""),
    );
    const args: any[] = [
      JSON.stringify(result.state),
      result.state.revision,
      result.state.updatedAt,
      ownerId,
      old.revision,
    ];
    if (outbound) args.push(outbound.id);
    let changed = false;
    if (outbound) {
      const batch = [
        update.bind(...args),
        db
          .prepare(
            "INSERT OR IGNORE INTO event_receipts(id,owner_id,received_at) SELECT ?,?,? WHERE changes()=1",
          )
          .bind(outbound.id, ownerId, Date.now()),
      ];
      if (result.reply)
        batch.push(
          db
            .prepare(
              "INSERT OR IGNORE INTO outbox(id,owner_id,reply,parent_id,status,created_at) SELECT ?,?,?,?,'pending',? WHERE changes()=1",
            )
            .bind(
              outbound.id,
              ownerId,
              result.reply,
              outbound.parentId ?? null,
              new Date().toISOString(),
            ),
        );
      const writes = await db.batch(batch);
      changed = writes[0].meta.changes === 1;
    } else changed = (await update.bind(...args).run()).meta.changes === 1;
    if (changed) return result;
  }
  throw new HttpError(
    409,
    "The studio changed concurrently. Please try again.",
  );
}
export async function lookupOwner(broadcasterId: string) {
  return runtime()
    .DB.prepare("SELECT owner_id FROM integrations WHERE broadcaster_id=?")
    .bind(broadcasterId)
    .first<{ owner_id: string }>();
}
