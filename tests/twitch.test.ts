import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const ORIGIN = "https://rallypoint.example";
const SCOPES = ["user:read:chat", "user:write:chat", "user:bot", "channel:bot"];
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const clone = (value: any) =>
  value === undefined ? undefined : structuredClone(value);
class MemoryFirestore {
  rows = new Map<string, any>();
  commits: string[][] = [];
  rejectWritePath: string | null = null;
  chain: Promise<unknown> = Promise.resolve();
  snapshot(path: string) {
    const value = clone(this.rows.get(path));
    return {
      exists: value !== undefined,
      data: () => clone(value),
      get: (field: string) => clone(value?.[field]),
      ref: this.ref(path),
    };
  }
  ref(path: string): any {
    return {
      path,
      get: async () => this.snapshot(path),
      set: async (value: any) => this.rows.set(path, clone(value)),
    };
  }
  collection(name: string): any {
    const db = this;
    const query = (field?: string, value?: any, limit = Infinity): any => ({
      doc: (id: string) => db.ref(name + "/" + id),
      where: (nextField: string, operation: string, nextValue: any) => {
        assert.equal(operation, "==");
        return query(nextField, nextValue, limit);
      },
      limit: (nextLimit: number) => query(field, value, nextLimit),
      get: async () => {
        const docs = [...db.rows]
          .filter(
            ([key, row]) =>
              key.startsWith(name + "/") &&
              (field === undefined || row[field] === value),
          )
          .slice(0, limit)
          .map(([path]) => db.snapshot(path));
        return { empty: docs.length === 0, docs };
      },
    });
    return query();
  }
  runTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    const promise = this.chain.then(async () => {
      const writes: Array<() => void> = [];
      const paths: string[] = [];
      let writing = false;
      const tx = {
        get: async (ref: any) => {
          assert.equal(
            writing,
            false,
            "Firestore transactions must read before writing",
          );
          return this.snapshot(ref.path);
        },
        set: (ref: any, value: any) => {
          paths.push(ref.path);
          writing = true;
          writes.push(() => this.rows.set(ref.path, clone(value)));
        },
        update: (ref: any, value: any) => {
          if (this.rejectWritePath === ref.path)
            throw new Error("Injected transaction write failure.");
          paths.push(ref.path);
          writing = true;
          writes.push(() => {
            assert.ok(this.rows.has(ref.path));
            this.rows.set(ref.path, {
              ...this.rows.get(ref.path),
              ...clone(value),
            });
          });
        },
        delete: (ref: any) => {
          paths.push(ref.path);
          writing = true;
          writes.push(() => this.rows.delete(ref.path));
        },
      };
      const result = await callback(tx);
      for (const write of writes) write();
      this.commits.push(paths);
      return result;
    });
    this.chain = promise.catch(() => {});
    return promise;
  }
  batch() {
    const paths: string[] = [];
    return {
      delete: (ref: any) => paths.push(ref.path),
      commit: async () => {
        for (const path of paths) this.rows.delete(path);
      },
    };
  }
}
async function harness() {
  const db = new MemoryFirestore();
  const env = {
    TWITCH_CLIENT_ID: "fixture-client",
    TWITCH_CLIENT_SECRET: "fixture-secret",
    TWITCH_WEBHOOK_SECRET: "fixture-webhook-secret",
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 13).toString("base64"),
    SITE_URL: ORIGIN,
  };
  const context = { db, env, hash };
  (globalThis as any).__rallyTwitchTest = context;
  const uri = (source: string) =>
    "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  const compile = (source: string) =>
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
  const securityUri = uri(
    compile(
      await readFile(
        new URL("../lib/server/security.ts", import.meta.url),
        "utf8",
      ),
    ),
  );
  const security = await import(securityUri);
  const replacements = {
    "./security": securityUri,
    "./store": uri(
      "export const store=()=>globalThis.__rallyTwitchTest.db;export const docId=(value)=>globalThis.__rallyTwitchTest.hash(value);",
    ),
    "./env": uri(
      "export const runtime=()=>globalThis.__rallyTwitchTest.env;export const configured=()=>true;export const siteOrigin=()=>globalThis.__rallyTwitchTest.env.SITE_URL;",
    ),
  };
  let source = compile(
    await readFile(new URL("../lib/server/twitch.ts", import.meta.url), "utf8"),
  );
  for (const [path, replacement] of Object.entries(replacements))
    source = source
      .replaceAll('"' + path + '"', '"' + replacement + '"')
      .replaceAll("'" + path + "'", "'" + replacement + "'");
  const api = await import(
    uri(source + "\n// Fresh module " + crypto.randomUUID())
  );
  const originalFetch = globalThis.fetch;
  let responder: (
    url: string,
    init: RequestInit,
  ) => Promise<Response> | Response = () => {
    throw new Error("Unexpected network call");
  };
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return responder(String(url), init);
  };
  const token = async (access = "fixture-access", expired = false) =>
    security.encrypt(
      {
        access_token: access,
        refresh_token: "fixture-refresh",
        expiresAt: expired ? Date.now() - 1000 : Date.now() + 3600000,
        validatedAt: Date.now(),
      },
      env.TOKEN_ENCRYPTION_KEY,
    );
  const seed = async (owner = "owner-1", expired = false) => {
    const row = {
      owner_id: owner,
      broadcaster_id: "123456",
      channel: "fixture_channel",
      encrypted_tokens: await token("fixture-access", expired),
      scopes: JSON.stringify(SCOPES),
      subscription_ids: JSON.stringify(["chat-sub", "raid-sub"]),
      status: "connected",
      error: null,
      delivery_error: null,
      updated_at: new Date().toISOString(),
      authorization_id: "auth-original",
      refresh_lease: null,
    };
    db.rows.set("integrations/" + owner, row);
    db.rows.set("channels/" + hash(row.broadcaster_id), { owner_id: owner });
    return row;
  };
  const outbox = (eventId = "event-1", extra: Record<string, any> = {}) => {
    db.rows.set("outbox/" + hash("owner-1:" + eventId), {
      eventId,
      owner_id: "owner-1",
      reply: "NOW: Build a bridge. JOIN: !join A",
      status: "pending",
      parent_id: "message-1",
      created_at: new Date().toISOString(),
      brief_version: 3,
      brief_expires_at: new Date(Date.now() + 600000).toISOString(),
      public_id: "public-fixture",
      ...extra,
    });
    db.rows.set("publicRooms/public-fixture", {
      owner_id: "owner-1",
      state: {
        brief: {
          version: 3,
          status: "live",
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        },
      },
    });
  };
  return {
    api,
    db,
    calls,
    seed,
    token,
    outbox,
    respond: (fn: typeof responder) => (responder = fn),
    restore: () => {
      globalThis.fetch = originalFetch;
      delete (globalThis as any).__rallyTwitchTest;
    },
  };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const sub = (id: string, type: string) => ({
  id,
  type,
  status: "enabled",
  condition:
    type === "channel.raid"
      ? { to_broadcaster_user_id: "123456" }
      : { broadcaster_user_id: "123456", user_id: "123456" },
  transport: { method: "webhook", callback: ORIGIN + "/api/twitch/webhook" },
});
const authResponse = () =>
  json({
    access_token: "fresh-access",
    refresh_token: "fresh-refresh",
    expires_in: 3600,
  });
const validationResponse = () =>
  json({
    client_id: "fixture-client",
    user_id: "123456",
    login: "fixture_channel",
    scopes: SCOPES,
  });

test("Twitch authorization atomically enforces one owner per channel", async () => {
  const h = await harness();
  try {
    h.respond((url) =>
      url.endsWith("/validate") ? validationResponse() : authResponse(),
    );
    const owners = ["owner-1", "owner-2"];
    const result = await Promise.allSettled(
      owners.map((owner, index) =>
        h.api.saveAuthorization(owner, `code-${index}`, ORIGIN),
      ),
    );
    const winners = result.flatMap((outcome, index) =>
      outcome.status === "fulfilled"
        ? [{ owner: owners[index], channel: outcome.value }]
        : [],
    );
    assert.equal(winners.length, 1);
    const winner = winners[0];
    const loser = owners.find((owner) => owner !== winner.owner)!;
    assert.equal(winner.channel, "fixture_channel");
    assert.equal(
      [...h.db.rows.keys()].filter((key) => key.startsWith("integrations/"))
        .length,
      1,
    );
    assert.equal(
      h.db.rows.get("channels/" + hash("123456")).owner_id,
      winner.owner,
    );
    const saved = h.db.rows.get("integrations/" + winner.owner);
    assert.equal(saved.owner_id, winner.owner);
    assert.equal(saved.broadcaster_id, "123456");
    assert.equal(saved.channel, winner.channel);
    assert.equal(h.db.rows.has("integrations/" + loser), false);
    const rejected = result.find((outcome) => outcome.status === "rejected");
    assert.ok(rejected && rejected.status === "rejected");
    assert.equal(rejected.reason.status, 409);
  } finally {
    h.restore();
  }
});
test("Twitch refuses missing scopes before storing authorization", async () => {
  const h = await harness();
  try {
    h.respond((url) =>
      url.endsWith("/validate")
        ? json({
            client_id: "fixture-client",
            user_id: "123456",
            login: "fixture_channel",
            scopes: [],
          })
        : authResponse(),
    );
    await assert.rejects(
      h.api.saveAuthorization("owner-1", "code", ORIGIN),
      /permissions/,
    );
    assert.equal(h.db.rows.size, 0);
  } finally {
    h.restore();
  }
});
test("EventSub traverses pagination and rejects a repeating cursor", async () => {
  const h = await harness();
  try {
    h.respond((url) =>
      new URL(url).searchParams.has("after")
        ? json({ data: [sub("raid-sub", "channel.raid")], pagination: {} })
        : json({
            data: [sub("chat-sub", "channel.chat.message")],
            pagination: { cursor: "page-two" },
          }),
    );
    assert.equal(
      (await h.api.listEventSubscriptions("fixture-token")).length,
      2,
    );
    h.respond(() => json({ data: [], pagination: { cursor: "again" } }));
    await assert.rejects(
      h.api.listEventSubscriptions("fixture-token"),
      /pagination/,
    );
  } finally {
    h.restore();
  }
});
test("connection verification finds enabled subscriptions beyond the first page", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.respond((url) =>
      url.includes("oauth2/token")
        ? json({ access_token: "app-token", expires_in: 3600 })
        : new URL(url).searchParams.has("after")
          ? json({
              data: [
                sub("chat-sub", "channel.chat.message"),
                sub("raid-sub", "channel.raid"),
              ],
              pagination: {},
            })
          : json({ data: [], pagination: { cursor: "next" } }),
    );
    const connection = await h.api.connectionFor(
      "owner-1",
      new Request(ORIGIN),
      true,
    );
    assert.equal(connection.connected, true);
    assert.equal(h.db.rows.get("integrations/owner-1").status, "connected");
  } finally {
    h.restore();
  }
});
test("concurrent refreshes share a distributed lease and rotate only once", async () => {
  const h = await harness();
  try {
    const row = await h.seed("owner-1", true);
    let refreshes = 0;
    h.respond(async () => {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return authResponse();
    });
    const results = await Promise.all([
      h.api.userToken(row),
      h.api.userToken(row),
    ]);
    assert.deepEqual(results, ["fresh-access", "fresh-access"]);
    assert.equal(refreshes, 1);
    assert.equal(h.db.rows.get("integrations/owner-1").refresh_lease, null);
  } finally {
    h.restore();
  }
});
test("provider outage preserves authorization while revoked refresh requires reconnect", async () => {
  const h = await harness();
  try {
    const row = await h.seed("owner-1", true);
    h.respond(() => json({}, 503));
    await assert.rejects(h.api.userToken(row));
    assert.equal(
      h.db.rows.get("integrations/owner-1").encrypted_tokens,
      row.encrypted_tokens,
    );
    assert.equal(h.db.rows.get("integrations/owner-1").status, "connected");
    assert.equal(h.db.rows.get("integrations/owner-1").refresh_lease, null);
    h.respond(() => json({}, 400));
    await assert.rejects(h.api.userToken(row), /expired/);
    assert.equal(h.db.rows.get("integrations/owner-1").status, "error");
  } finally {
    h.restore();
  }
});
test("a reconnect winning token rotation returns the new authorization", async () => {
  const h = await harness();
  try {
    const row = await h.seed("owner-1", true);
    const currentToken = await h.token("reconnected-access");
    h.respond(() => {
      h.db.rows.set("integrations/owner-1", {
        ...h.db.rows.get("integrations/owner-1"),
        authorization_id: "auth-new",
        encrypted_tokens: currentToken,
        refresh_lease: null,
      });
      return authResponse();
    });
    assert.equal(await h.api.userToken(row), "reconnected-access");
    assert.equal(
      h.db.rows.get("integrations/owner-1").encrypted_tokens,
      currentToken,
    );
  } finally {
    h.restore();
  }
});
test("duplicate queue deliveries claim one reply and never send twice", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.outbox();
    let sent = 0;
    h.respond(() => {
      sent++;
      return json({ data: [{ is_sent: true }] });
    });
    const attempts = await Promise.allSettled([
      h.api.flushReply("owner-1", "event-1"),
      h.api.flushReply("owner-1", "event-1"),
    ]);
    assert.equal(
      attempts.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      attempts.filter((result) => result.status === "rejected").length,
      1,
    );
    assert.equal(sent, 1);
    assert.equal(
      h.db.rows.get("outbox/" + hash("owner-1:event-1")).status,
      "sent",
    );
  } finally {
    h.restore();
  }
});
test("an ambiguous send failure is visible and is not automatically repeated", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.outbox();
    let attempts = 0;
    h.respond(() => {
      attempts++;
      throw new Error("Network lost after accepting request");
    });
    await h.api.flushReply("owner-1", "event-1");
    await h.api.flushReply("owner-1", "event-1");
    assert.equal(attempts, 1);
    assert.equal(
      h.db.rows.get("outbox/" + hash("owner-1:event-1")).status,
      "failed",
    );
    assert.match(
      h.db.rows.get("integrations/owner-1").delivery_error,
      /not confirmed/,
    );
    const connection = await h.api.connectionFor(
      "owner-1",
      new Request(ORIGIN),
    );
    assert.match(connection.error, /not confirmed/);
  } finally {
    h.restore();
  }
});
test("a transient failure before sending leaves the reply safely retryable", async () => {
  const h = await harness();
  try {
    await h.seed("owner-1", true);
    h.outbox();
    h.respond(() => json({}, 503));
    await assert.rejects(
      h.api.flushReply("owner-1", "event-1"),
      /temporarily unavailable/,
    );
    assert.equal(
      h.db.rows.get("outbox/" + hash("owner-1:event-1")).status,
      "pending",
    );
  } finally {
    h.restore();
  }
});
test("queued invitations are suppressed after chapter change, closure or a minute delay", async () => {
  const h = await harness();
  try {
    await h.seed();
    for (const reason of ["new-version", "closed", "delayed"]) {
      h.outbox(
        reason,
        reason === "delayed"
          ? { created_at: new Date(Date.now() - 61000).toISOString() }
          : {},
      );
      const publication = h.db.rows.get("publicRooms/public-fixture");
      if (reason === "new-version") publication.state.brief.version = 4;
      if (reason === "closed") publication.state.brief.status = "closed";
      await h.api.flushReply("owner-1", reason);
      assert.equal(
        h.db.rows.get("outbox/" + hash("owner-1:" + reason)).status,
        "failed",
      );
    }
    assert.equal(h.calls.length, 0);
    assert.match(
      h.db.rows.get("integrations/owner-1").delivery_error,
      /suppressed/,
    );
  } finally {
    h.restore();
  }
});
test("a fresh no-active-brief reply still delivers after expiry", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.outbox("event-1", {
      reply: "There is no active participation brief right now.",
      brief_expires_at: new Date(Date.now() - 10000).toISOString(),
    });
    h.db.rows.delete("publicRooms/public-fixture");
    h.respond(() => json({ data: [{ is_sent: true }] }));
    await h.api.flushReply("owner-1", "event-1");
    assert.equal(
      h.db.rows.get("outbox/" + hash("owner-1:event-1")).status,
      "sent",
    );
  } finally {
    h.restore();
  }
});
test("disconnect revokes despite subscription cleanup failure and preserves another owner's mapping", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.db.rows.set("channels/" + hash("123456"), { owner_id: "owner-2" });
    h.outbox();
    let revokes = 0;
    h.respond((url) => {
      if (url.endsWith("/revoke")) {
        revokes++;
        return new Response(null, { status: 200 });
      }
      return json({}, 503);
    });
    assert.equal(await h.api.disconnect("owner-1"), true);
    assert.equal(revokes, 1);
    assert.equal(h.db.rows.has("integrations/owner-1"), false);
    assert.equal(
      h.db.rows.get("channels/" + hash("123456")).owner_id,
      "owner-2",
    );
    assert.equal(
      [...h.db.rows.keys()].some((key) => key.startsWith("outbox/")),
      false,
    );
  } finally {
    h.restore();
  }
});

test("an abandoned sending claim expires visibly without repeating an ambiguous send", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.outbox("abandoned", {
      status: "sending",
      created_at: new Date(Date.now() - 61000).toISOString(),
    });
    await h.api.flushReply("owner-1", "abandoned");
    assert.equal(h.calls.length, 0);
    assert.equal(
      h.db.rows.get("outbox/" + hash("owner-1:abandoned")).status,
      "failed",
    );
    assert.match(
      h.db.rows.get("integrations/owner-1").delivery_error,
      /not be resent/,
    );
  } finally {
    h.restore();
  }
});

test("public readiness sync enables verified chat once and preserves an unchanged snapshot", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    h.db.rows.set("publicRooms/public-fixture", {
      owner_id: "owner-1",
      state: { chatReady: false, brief: { title: "Keep this" } },
    });
    await h.api.syncPublicConnection("owner-1", true);
    const first = h.db.rows.get("publicRooms/public-fixture");
    assert.equal(first.state.chatReady, true);
    assert.equal(first.state.brief.title, "Keep this");
    await h.api.syncPublicConnection("owner-1", true);
    assert.equal(h.db.rows.get("publicRooms/public-fixture"), first);
  } finally {
    h.restore();
  }
});
test("stale verification cannot enable a disconnected or foreign public room", async () => {
  const h = await harness();
  try {
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    h.db.rows.set("publicRooms/public-fixture", {
      owner_id: "owner-1",
      state: { chatReady: true },
    });
    await h.api.syncPublicConnection("owner-1", true);
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      false,
    );
    const foreign = { owner_id: "owner-2", state: { chatReady: true } };
    h.db.rows.set("publicRooms/public-fixture", foreign);
    await h.api.syncPublicConnection("owner-1", false);
    assert.equal(h.db.rows.get("publicRooms/public-fixture"), foreign);
  } finally {
    h.restore();
  }
});
test("failed verification pauses a previously active public invitation", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    h.db.rows.set("publicRooms/public-fixture", {
      owner_id: "owner-1",
      state: { chatReady: true },
    });
    h.respond(() => new Response("", { status: 503 }));
    const result = await h.api.connectionFor(
      "owner-1",
      new Request(ORIGIN),
      true,
    );
    assert.equal(result.connected, false);
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      false,
    );
  } finally {
    h.restore();
  }
});
test("disconnect pauses public invitations even when remote cleanup fails", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    h.db.rows.set("publicRooms/public-fixture", {
      owner_id: "owner-1",
      state: { chatReady: true },
    });
    h.respond(() => new Response("", { status: 503 }));
    await h.api.disconnect("owner-1");
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      false,
    );
  } finally {
    h.restore();
  }
});

test("a revoked refresh pauses public invitations during queued delivery without a studio poll", async () => {
  const h = await harness();
  try {
    await h.seed("owner-1", true);
    h.outbox();
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    h.db.rows.get("publicRooms/public-fixture").state.chatReady = true;
    h.respond(() => json({}, 400));
    await h.api.flushReply("owner-1", "event-1");
    assert.equal(h.db.rows.get("integrations/owner-1").status, "error");
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      false,
    );
    assert.equal(
      h.db.rows.get("outbox/" + hash("owner-1:event-1")).status,
      "failed",
    );
    assert.equal(
      h.calls.filter((call) => call.url.includes("helix/chat/messages")).length,
      0,
    );
  } finally {
    h.restore();
  }
});

test("a transient token outage keeps authorization and public readiness while delivery retries", async () => {
  const h = await harness();
  try {
    await h.seed("owner-1", true);
    h.outbox();
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    h.db.rows.get("publicRooms/public-fixture").state.chatReady = true;
    h.respond(() => json({}, 503));
    await assert.rejects(
      h.api.flushReply("owner-1", "event-1"),
      /temporarily unavailable/,
    );
    assert.equal(h.db.rows.get("integrations/owner-1").status, "connected");
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      true,
    );
    assert.equal(
      h.db.rows.get("outbox/" + hash("owner-1:event-1")).status,
      "pending",
    );
  } finally {
    h.restore();
  }
});

test("pending authorization and subscription setup pause an older verified invitation", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    h.db.rows.set("publicRooms/public-fixture", {
      owner_id: "owner-1",
      state: { chatReady: true },
    });
    h.respond((url) =>
      url.endsWith("/validate") ? validationResponse() : authResponse(),
    );
    await h.api.saveAuthorization("owner-1", "code", ORIGIN);
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      false,
    );
    h.db.rows.get("integrations/owner-1").status = "connected";
    h.db.rows.get("publicRooms/public-fixture").state.chatReady = true;
    h.respond((url) =>
      url.includes("oauth2/token")
        ? json({ access_token: "app-token", expires_in: 3600 })
        : json({
            data: [
              sub("chat-sub", "channel.chat.message"),
              sub("raid-sub", "channel.raid"),
            ],
            pagination: {},
          }),
    );
    await h.api.subscriptions("owner-1", ORIGIN);
    assert.equal(h.db.rows.get("integrations/owner-1").status, "connecting");
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      false,
    );
  } finally {
    h.restore();
  }
});

test("an old revocation or missing-integration observation cannot pause a newer authorization", async () => {
  const h = await harness();
  try {
    const old = { ...(await h.seed()), status: "error" };
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    h.db.rows.set("publicRooms/public-fixture", {
      owner_id: "owner-1",
      state: { chatReady: true },
    });
    h.db.rows.get("integrations/owner-1").authorization_id =
      "new-authorization";
    await h.api.syncPublicConnection("owner-1", false, old);
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      true,
    );
    await h.api.syncPublicConnection("owner-1", false, null);
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      true,
    );
  } finally {
    h.restore();
  }
});

for (const status of [401, 403]) {
  test(`a definitive chat ${status} immediately pauses the matching public invitation without resend`, async () => {
    const h = await harness();
    try {
      await h.seed();
      h.outbox();
      h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
      h.db.rows.get("publicRooms/public-fixture").state.chatReady = true;
      let attempts = 0;
      h.respond(() => {
        attempts++;
        return json({}, status);
      });
      await h.api.flushReply("owner-1", "event-1");
      await h.api.flushReply("owner-1", "event-1");
      assert.equal(attempts, 1);
      const connection = h.db.rows.get("integrations/owner-1");
      assert.equal(connection.status, "error");
      assert.match(connection.error, /reconnect Twitch/);
      assert.match(connection.delivery_error, /will not be resent/);
      assert.equal(
        h.db.rows.get("publicRooms/public-fixture").state.chatReady,
        false,
      );
      assert.equal(
        h.db.rows.get("outbox/" + hash("owner-1:event-1")).status,
        "failed",
      );
      const publicConnection = await h.api.connectionFor(
        "owner-1",
        new Request(ORIGIN),
        true,
      );
      assert.equal(publicConnection.connected, false);
      assert.equal(connection.chat_authorization_error, true);
      assert.equal(
        attempts,
        1,
        "Polling must not trust a cached token that was denied",
      );
      assert.equal(
        h.db.rows.get("publicRooms/public-fixture").state.chatReady,
        false,
      );
      await assert.rejects(
        h.api.subscriptions("owner-1", ORIGIN),
        /Reconnect Twitch/,
      );
      assert.equal(attempts, 1);
    } finally {
      h.restore();
    }
  });
}

for (const change of ["reconnected", "rotated", "disconnecting"]) {
  test(`an old send denial preserves a ${change} authorization`, async () => {
    const h = await harness();
    try {
      await h.seed();
      h.outbox();
      h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
      h.db.rows.get("publicRooms/public-fixture").state.chatReady =
        change !== "disconnecting";
      const replacement = await h.token("replacement-access");
      h.respond(() => {
        const current = h.db.rows.get("integrations/owner-1");
        h.db.rows.set("integrations/owner-1", {
          ...current,
          ...(change === "reconnected"
            ? {
                authorization_id: "new-authorization",
                encrypted_tokens: replacement,
              }
            : {}),
          ...(change === "rotated" ? { encrypted_tokens: replacement } : {}),
          ...(change === "disconnecting" ? { status: "disconnecting" } : {}),
          error: null,
          delivery_error: null,
        });
        return json({}, 401);
      });
      await h.api.flushReply("owner-1", "event-1");
      const current = h.db.rows.get("integrations/owner-1");
      assert.equal(
        current.status,
        change === "disconnecting" ? "disconnecting" : "connected",
      );
      assert.equal(current.error, null);
      assert.equal(current.delivery_error, null);
      assert.equal(
        h.db.rows.get("publicRooms/public-fixture").state.chatReady,
        change !== "disconnecting",
      );
      assert.equal(
        h.db.rows.get("outbox/" + hash("owner-1:event-1")).status,
        "failed",
      );
    } finally {
      h.restore();
    }
  });
}

test("denial is correlated to the actual token returned when reconnect wins a refresh", async () => {
  const h = await harness();
  try {
    await h.seed("owner-1", true);
    h.outbox();
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    h.db.rows.get("publicRooms/public-fixture").state.chatReady = true;
    const replacement = await h.token("replacement-access");
    let sends = 0;
    h.respond((url, init) => {
      if (url.includes("oauth2/token")) {
        h.db.rows.set("integrations/owner-1", {
          ...h.db.rows.get("integrations/owner-1"),
          authorization_id: "new-authorization",
          encrypted_tokens: replacement,
          refresh_lease: null,
        });
        return authResponse();
      }
      sends++;
      assert.equal(
        new Headers(init.headers).get("Authorization"),
        "Bearer replacement-access",
      );
      return json({}, 403);
    });
    await h.api.flushReply("owner-1", "event-1");
    const current = h.db.rows.get("integrations/owner-1");
    assert.equal(sends, 1);
    assert.equal(current.authorization_id, "new-authorization");
    assert.equal(current.status, "error");
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      false,
    );
  } finally {
    h.restore();
  }
});

test("network ambiguity, rate limits, upstream failures, and held replies retain existing send behavior", async () => {
  for (const reason of ["network", "429", "500", "409", "held"]) {
    const h = await harness();
    try {
      await h.seed();
      h.outbox();
      h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
      h.db.rows.get("publicRooms/public-fixture").state.chatReady = true;
      let attempts = 0;
      h.respond(() => {
        attempts++;
        if (reason === "network") throw new Error("Ambiguous send response");
        return reason === "held"
          ? json({ data: [{ is_sent: false }] })
          : json({}, Number(reason));
      });
      await h.api.flushReply("owner-1", "event-1");
      await h.api.flushReply("owner-1", "event-1");
      assert.equal(attempts, 1, reason);
      assert.equal(
        h.db.rows.get("integrations/owner-1").status,
        "connected",
        reason,
      );
      assert.equal(
        h.db.rows.get("publicRooms/public-fixture").state.chatReady,
        true,
        reason,
      );
      assert.equal(
        h.db.rows.get("outbox/" + hash("owner-1:event-1")).status,
        "failed",
        reason,
      );
    } finally {
      h.restore();
    }
  }
});

test("new OAuth authorization clears a definitive chat denial and can verify normally", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.outbox();
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    h.db.rows.get("publicRooms/public-fixture").state.chatReady = true;
    h.respond(() => json({}, 403));
    await h.api.flushReply("owner-1", "event-1");
    assert.equal(
      h.db.rows.get("integrations/owner-1").chat_authorization_error,
      true,
    );
    h.respond((url) =>
      url.endsWith("/validate") ? validationResponse() : authResponse(),
    );
    await h.api.saveAuthorization("owner-1", "new-code", ORIGIN);
    assert.equal(
      h.db.rows.get("integrations/owner-1").chat_authorization_error,
      undefined,
    );
    h.respond((url) =>
      url.includes("oauth2/token")
        ? json({ access_token: "app-token", expires_in: 3600 })
        : json({
            data: [
              sub("chat-sub", "channel.chat.message"),
              sub("raid-sub", "channel.raid"),
            ],
            pagination: {},
          }),
    );
    const current = await h.api.connectionFor(
      "owner-1",
      new Request(ORIGIN),
      true,
    );
    assert.equal(current.connected, true);
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      true,
    );
  } finally {
    h.restore();
  }
});

test("an in-flight verification cannot restore readiness after the same token receives a chat denial", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.outbox();
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    h.db.rows.get("publicRooms/public-fixture").state.chatReady = true;
    h.respond(async (url) => {
      if (url.includes("oauth2/token"))
        return json({ access_token: "app-token", expires_in: 3600 });
      if (url.includes("eventsub/subscriptions")) {
        await h.api.flushReply("owner-1", "event-1");
        return json({
          data: [
            sub("chat-sub", "channel.chat.message"),
            sub("raid-sub", "channel.raid"),
          ],
          pagination: {},
        });
      }
      return json({}, 401);
    });
    const connection = await h.api.connectionFor(
      "owner-1",
      new Request(ORIGIN),
      true,
    );
    assert.equal(connection.connected, false);
    assert.equal(h.db.rows.get("integrations/owner-1").status, "error");
    assert.equal(
      h.db.rows.get("integrations/owner-1").chat_authorization_error,
      true,
    );
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      false,
    );
  } finally {
    h.restore();
  }
});

for (const source of ["send", "refresh"]) {
  test(`${source} authorization failure pauses its public snapshot in the same transaction`, async () => {
    const h = await harness();
    try {
      await h.seed("owner-1", source === "refresh");
      h.outbox();
      h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
      h.db.rows.get("publicRooms/public-fixture").state.chatReady = true;
      h.respond(() => json({}, source === "send" ? 403 : 400));
      await h.api.flushReply("owner-1", "event-1");
      const outboxPath = "outbox/" + hash("owner-1:event-1");
      assert.equal(h.db.rows.get("integrations/owner-1").status, "error");
      assert.equal(
        h.db.rows.get("publicRooms/public-fixture").state.chatReady,
        false,
      );
      assert.equal(h.db.rows.get(outboxPath).status, "failed");
      assert.ok(
        h.db.commits.some(
          (paths) =>
            paths.includes("integrations/owner-1") &&
            paths.includes("publicRooms/public-fixture") &&
            (source === "refresh" || paths.includes(outboxPath)),
        ),
        "public pause and authorization error must commit together; a send denial also commits outbox failure",
      );
    } finally {
      h.restore();
    }
  });
}

test("a public-pause write failure cannot leave committed authorization or failed outbox state", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.outbox();
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    h.db.rows.get("publicRooms/public-fixture").state.chatReady = true;
    h.db.rejectWritePath = "publicRooms/public-fixture";
    let sends = 0;
    h.respond(() => {
      sends++;
      return json({}, 401);
    });
    await assert.rejects(
      h.api.flushReply("owner-1", "event-1"),
      /Injected transaction write failure/,
    );
    assert.equal(sends, 1);
    const connection = h.db.rows.get("integrations/owner-1");
    assert.equal(connection.status, "connected");
    assert.equal(connection.chat_authorization_error, undefined);
    assert.equal(connection.error, null);
    assert.equal(connection.delivery_error, null);
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      true,
    );
    assert.equal(
      h.db.rows.get("outbox/" + hash("owner-1:event-1")).status,
      "sending",
    );
  } finally {
    h.restore();
  }
});

test("an atomic authorization pause never mutates another owner's public snapshot", async () => {
  const h = await harness();
  try {
    await h.seed();
    h.outbox();
    h.db.rows.set("rooms/owner-1", { public_id: "public-fixture" });
    let foreign: Record<string, unknown> | undefined;
    h.respond(() => {
      foreign = {
        ...h.db.rows.get("publicRooms/public-fixture"),
        owner_id: "owner-2",
        state: { chatReady: true },
      };
      h.db.rows.set("publicRooms/public-fixture", foreign);
      return json({}, 403);
    });
    await h.api.flushReply("owner-1", "event-1");
    assert.equal(h.db.rows.get("integrations/owner-1").status, "error");
    assert.equal(h.db.rows.get("publicRooms/public-fixture"), foreign);
    assert.equal(
      h.db.rows.get("publicRooms/public-fixture").state.chatReady,
      true,
    );
    assert.equal(
      h.db.commits.some((paths) =>
        paths.includes("publicRooms/public-fixture"),
      ),
      false,
    );
  } finally {
    h.restore();
  }
});
