import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { Timestamp } from "firebase-admin/firestore";
import ts from "typescript";
import { createState } from "../lib/rally/engine.ts";
import type { RallyState } from "../lib/rally/types";

function clone(value: any): any {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof Timestamp) return Timestamp.fromMillis(value.toMillis());
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, clone(child)]),
    );
  return value;
}
/** Serial transactions test application boundaries, not Firestore's own retry implementation. */
class MemoryFirestore {
  rows = new Map<string, any>();
  chain: Promise<unknown> = Promise.resolve();
  failNextWrite = false;
  snapshot(path: string): any {
    const value = clone(this.rows.get(path));
    return {
      exists: value !== undefined,
      data: () => clone(value),
      get: (key: string) => clone(value?.[key]),
      ref: this.ref(path),
    };
  }
  ref(path: string): any {
    return { path, get: async () => this.snapshot(path) };
  }
  collection(name: string): any {
    return { doc: (id: string) => this.ref(name + "/" + id) };
  }
  runTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    const promise = this.chain.then(async () => {
      const writes: Array<(draft: Map<string, any>) => void> = [];
      let writing = false;
      const tx = {
        get: async (ref: any) => {
          assert.equal(
            writing,
            false,
            "All transaction reads must precede writes",
          );
          return this.snapshot(ref.path);
        },
        create: (ref: any, value: any) => {
          writing = true;
          writes.push((draft) => {
            assert.equal(draft.has(ref.path), false);
            draft.set(ref.path, clone(value));
          });
        },
        set: (ref: any, value: any) => {
          writing = true;
          writes.push((draft) => draft.set(ref.path, clone(value)));
        },
        update: (ref: any, value: any) => {
          writing = true;
          writes.push((draft) => {
            assert.ok(draft.has(ref.path));
            draft.set(ref.path, { ...draft.get(ref.path), ...clone(value) });
          });
        },
        delete: (ref: any) => {
          writing = true;
          writes.push((draft) => draft.delete(ref.path));
        },
      };
      const result = await callback(tx);
      if (writes.length && this.failNextWrite) {
        this.failNextWrite = false;
        throw new Error("Injected storage failure");
      }
      const draft = new Map(
        [...this.rows].map(([key, value]) => [key, clone(value)]),
      );
      for (const write of writes) write(draft);
      this.rows = draft;
      return result;
    });
    this.chain = promise.catch(() => {});
    return promise;
  }
}
async function harness() {
  const db = new MemoryFirestore();
  (globalThis as any).__rallyStorageTest = { db };
  const uri = (source: string) =>
    "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  const compile = (source: string) =>
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
  const replace = (source: string, imports: Record<string, string>) => {
    for (const [path, replacement] of Object.entries(imports))
      source = source
        .replaceAll('"' + path + '"', '"' + replacement + '"')
        .replaceAll("'" + path + "'", "'" + replacement + "'");
    return source;
  };
  const timestampUri = import.meta.resolve("firebase-admin/firestore");
  const securityUri = uri(
    compile(
      await readFile(
        new URL("../lib/server/security.ts", import.meta.url),
        "utf8",
      ),
    ),
  );
  const engineUri = uri(
    compile(
      await readFile(
        new URL("../lib/rally/engine.ts", import.meta.url),
        "utf8",
      ),
    ),
  );
  const storeUri = uri(
    replace(
      compile(
        await readFile(
          new URL("../lib/server/store.ts", import.meta.url),
          "utf8",
        ),
      ),
      {
        "firebase-admin/firestore": timestampUri,
        "./firebase": uri(
          "export const firestore=()=>globalThis.__rallyStorageTest.db;",
        ),
        "./security": securityUri,
      },
    ),
  );
  const roomsUri = uri(
    replace(
      compile(
        await readFile(
          new URL("../lib/server/rooms.ts", import.meta.url),
          "utf8",
        ),
      ),
      {
        "firebase-admin/firestore": timestampUri,
        "../rally/engine": engineUri,
        "./store": storeUri,
        "./security": securityUri,
      },
    ),
  );
  return { db, storage: await import(storeUri), rooms: await import(roomsUri) };
}
const brief = () => ({
  title: "Bring Bubbles home",
  context: "The community is choosing a rescue route.",
  stakes: "Nightfall is close.",
  action: "Choose !join A or !join B.",
  choices: [
    { id: "A", label: "Bridge" },
    { id: "B", label: "Tunnel" },
  ],
  expiresAt: new Date(Date.now() + 600000).toISOString(),
});
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const command = (id: string, user: string, text = "!join A") => ({
  type: "chat",
  messageId: id,
  userId: user,
  name: "PRIVATE_VIEWER_" + user,
  text,
});

function largeRoom(): RallyState {
  const state = createState(
    {
      id: "sizing-room",
      publicId: "sizing-public",
      channel: "fixture_channel",
    },
    "2026-10-28T10:00:00Z",
  );
  state.contributions = Array.from({ length: 5000 }, (_, index) => ({
    id: hash("contribution-" + index).slice(0, 36),
    userId: String(1000000000 + index),
    name: "viewer_with_25_charactersx",
    choiceId: index % 2 ? "A" : "B",
    version: 1,
    at: "2026-10-28T10:00:00.000Z",
    raidId: "raid:" + hash("raid-" + index).slice(0, 36),
  }));
  state.processedIds = Array.from({ length: 2000 }, (_, index) =>
    hash("receipt-" + index).slice(0, 36),
  );
  state.cooldowns = Object.fromEntries(
    Array.from({ length: 4000 }, (_, index) => [
      "vote:" + String(1000000000 + index),
      1793181600000,
    ]),
  );
  return state;
}

test("a realistic 5000-contribution session fits the compressed Firestore bound and round-trips", async () => {
  const { storage } = await harness();
  const state = largeRoom();
  assert.ok(
    Buffer.byteLength(JSON.stringify(state)) > 1024 * 1024,
    "The raw fixture must exceed Firestore's one-document limit",
  );
  const encoded = storage.encodeState(state);
  assert.ok(encoded.byteLength < 900 * 1024);
  assert.deepEqual(storage.decodeState(encoded), state);
  assert.deepEqual(storage.decodeState(new Uint8Array(encoded)), state);
});
test("raw and compressed size limits reject unsafe documents before storage", async () => {
  const { storage } = await harness();
  const rawOverflow = createState();
  rawOverflow.brief.context = "x".repeat(4 * 1024 * 1024);
  assert.throws(
    () => storage.encodeState(rawOverflow),
    (error: any) =>
      error.status === 409 && /session is full/.test(error.message),
  );
  const compressedOverflow = createState();
  compressedOverflow.brief.context = randomBytes(1300000).toString("base64");
  assert.ok(
    Buffer.byteLength(JSON.stringify(compressedOverflow)) < 4 * 1024 * 1024,
  );
  assert.throws(
    () => storage.encodeState(compressedOverflow),
    (error: any) =>
      error.status === 409 && /session is full/.test(error.message),
  );
});
test("decode rejects corrupt encoding and bounded-decompression overflow", async () => {
  const { storage } = await harness();
  for (const value of [null, {}, "not-a-buffer", Buffer.from("not-gzip")])
    assert.throws(() => storage.decodeState(value));
  const bomb = gzipSync(
    Buffer.from(JSON.stringify({ content: "x".repeat(4 * 1024 * 1024) })),
  );
  assert.throws(() => storage.decodeState(bomb));
});
test("new rooms store private compressed state and a sanitized public projection", async () => {
  const { db, storage, rooms } = await harness();
  const state = await rooms.getRoom("owner-A", "PRIVATE_CREATOR_A");
  const row = db.rows.get("rooms/owner-A");
  assert.ok(Buffer.isBuffer(row.body));
  assert.equal(storage.decodeState(row.body).creator, "PRIVATE_CREATOR_A");
  const view = await rooms.findPublic(state.publicId);
  assert.equal(view.creator, "");
  assert.equal(JSON.stringify(view).includes("PRIVATE_CREATOR_A"), false);
  assert.equal(JSON.stringify(view).includes("owner-A"), false);
  assert.deepEqual(view.contributions, []);
  assert.deepEqual(view.proposals, []);
  assert.equal((await rooms.getRoom("owner-A")).id, state.id);
  assert.equal(
    [...db.rows.keys()].filter((key) => key.startsWith("rooms/")).length,
    1,
  );
});
test("owner operations remain isolated and public snapshots never reveal pitch or voter identities", async () => {
  const { db, storage, rooms } = await harness();
  const a = await rooms.getRoom("owner-A", "PRIVATE_CREATOR_A"),
    b = await rooms.getRoom("owner-B", "PRIVATE_CREATOR_B");
  await rooms.mutateRoom("owner-A", {
    type: "publish",
    brief: brief(),
    expectedVersion: 0,
  });
  await rooms.mutateRoom("owner-B", {
    type: "publish",
    brief: { ...brief(), title: "Owner B's independent mission" },
    expectedVersion: 0,
  });
  await rooms.mutateRoom(
    "owner-A",
    command("PRIVATE_MESSAGE_A", "PRIVATE_USER_A"),
    { id: "delivery-A" },
  );
  await rooms.mutateRoom(
    "owner-A",
    command(
      "PRIVATE_PITCH_A",
      "PITCH_USER_A",
      "!pitch PRIVATE_PITCH_TEXT_SENTINEL should wait for review.",
    ),
    { id: "pitch-delivery-A" },
  );
  const ownerA = storage.decodeState(db.rows.get("rooms/owner-A").body),
    ownerB = storage.decodeState(db.rows.get("rooms/owner-B").body);
  assert.equal(ownerA.contributions.length, 1);
  assert.equal(ownerA.proposals.length, 1);
  assert.equal(ownerB.contributions.length, 0);
  assert.equal(ownerB.proposals.length, 0);
  assert.equal(ownerB.brief.title, "Owner B's independent mission");
  const publicA = await rooms.findPublic(a.publicId),
    publicB = await rooms.findPublic(b.publicId),
    serialized = JSON.stringify(publicA);
  for (const privateText of [
    "PRIVATE_CREATOR_A",
    "PRIVATE_USER_A",
    "PRIVATE_VIEWER",
    "PRIVATE_MESSAGE_A",
    "PRIVATE_PITCH_TEXT_SENTINEL",
    "owner-A",
  ])
    assert.equal(serialized.includes(privateText), false, privateText);
  assert.equal(publicA.publicMetrics.currentContributors, 1);
  assert.equal(publicA.publicMetrics.counts.A, 1);
  assert.equal(publicB.publicMetrics.currentContributors, 0);
  assert.equal(await rooms.findPublic("../owner-A"), null);
});
test("event receipts and outbox are owner-scoped, atomic and idempotent", async () => {
  const { db, storage, rooms } = await harness();
  for (const owner of ["owner-A", "owner-B"]) {
    await rooms.getRoom(owner);
    await rooms.mutateRoom(owner, {
      type: "publish",
      brief: brief(),
      expectedVersion: 0,
    });
  }
  const action = command("same-chat-id", "u1", "!catchup");
  await rooms.mutateRoom("owner-A", action, {
    id: "same-delivery-id",
    parentId: "parent-chat-id",
  });
  const revision = storage.decodeState(
    db.rows.get("rooms/owner-A").body,
  ).revision;
  assert.equal(
    (await rooms.mutateRoom("owner-A", action, { id: "same-delivery-id" }))
      .changed,
    false,
  );
  assert.equal(
    storage.decodeState(db.rows.get("rooms/owner-A").body).revision,
    revision,
  );
  await rooms.mutateRoom("owner-B", action, {
    id: "same-delivery-id",
    parentId: "parent-chat-id",
  });
  assert.equal(
    [...db.rows.keys()].filter((key) => key.startsWith("receipts/")).length,
    2,
  );
  assert.equal(
    [...db.rows.keys()].filter((key) => key.startsWith("outbox/")).length,
    2,
  );
  const outbound = db.rows.get("outbox/" + hash("owner-A:same-delivery-id"));
  assert.equal(outbound.owner_id, "owner-A");
  assert.equal(outbound.parent_id, "parent-chat-id");
  assert.equal(outbound.brief_version, 1);
  assert.equal(outbound.status, "pending");
  assert.ok(outbound.expiresAt.toMillis() > Date.now() + 23 * 3600000);
  assert.ok(outbound.expiresAt.toMillis() < Date.now() + 25 * 3600000);
});
test("a failed storage transaction cannot partially publish state or an outbox item", async () => {
  const { db, storage, rooms } = await harness();
  const state = await rooms.getRoom("owner-A");
  await rooms.mutateRoom("owner-A", {
    type: "publish",
    brief: brief(),
    expectedVersion: 0,
  });
  const before = storage.decodeState(db.rows.get("rooms/owner-A").body);
  db.failNextWrite = true;
  await assert.rejects(
    rooms.mutateRoom("owner-A", command("chat-failed", "u1", "!catchup"), {
      id: "failed-delivery",
    }),
    /Injected storage failure/,
  );
  assert.deepEqual(
    storage.decodeState(db.rows.get("rooms/owner-A").body),
    before,
  );
  assert.equal(
    db.rows.has("receipts/" + hash("owner-A:failed-delivery")),
    false,
  );
  assert.equal(db.rows.has("outbox/" + hash("owner-A:failed-delivery")), false);
  assert.equal(
    (await rooms.findPublic(state.publicId)).revision,
    before.revision,
  );
});
test("reset preserves monotonic chapter versions so an old close cannot match a new session", async () => {
  const { rooms } = await harness();
  await rooms.getRoom("owner-A");
  let state = (
    await rooms.mutateRoom("owner-A", {
      type: "publish",
      brief: brief(),
      expectedVersion: 0,
    })
  ).state;
  const oldVersion = state.brief.version;
  state = (
    await rooms.mutateRoom("owner-A", {
      type: "reset",
      expectedRevision: state.revision,
    })
  ).state;
  assert.equal(state.brief.version, oldVersion);
  assert.equal(state.brief.status, "draft");
  state = (
    await rooms.mutateRoom("owner-A", {
      type: "publish",
      brief: brief(),
      expectedVersion: oldVersion,
    })
  ).state;
  assert.equal(state.brief.version, oldVersion + 1);
  await assert.rejects(
    rooms.mutateRoom("owner-A", { type: "close", expectedVersion: oldVersion }),
    (error: any) => error.status === 409,
  );
  assert.equal((await rooms.getRoom("owner-A")).brief.status, "live");
});
test("page-open receipts deduplicate a visitor while keeping private and public counts synchronized", async () => {
  const { rooms } = await harness();
  const state = await rooms.getRoom("owner-A");
  assert.equal(await rooms.recordOpen(state.publicId, "visitor-one"), true);
  assert.equal(await rooms.recordOpen(state.publicId, "visitor-one"), false);
  assert.equal(await rooms.recordOpen(state.publicId, "visitor-two"), true);
  assert.equal((await rooms.getRoom("owner-A")).opens, 2);
  assert.equal((await rooms.findPublic(state.publicId)).opens, 2);
});
