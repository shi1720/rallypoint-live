import test from "node:test";
import assert from "node:assert/strict";
// @ts-ignore Node's built-in type stripping requires explicit TypeScript file extensions.
import {
  HttpError,
  sameOrigin,
  readLimited,
  readJson,
  apiError,
  json,
  randomToken,
  sha256,
  hmac,
  constantEqual,
  cookie,
  encrypt,
  decrypt,
} from "../lib/server/security.ts";

const ORIGIN = "https://rallypoint.example";
const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(17)));
const otherKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(29)));
const post = (body: string, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/room`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers },
    body,
  });

test("SHA-256 matches the published abc test vector", async () => {
  assert.equal(
    await sha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("HMAC-SHA256 matches RFC 4231 case 2", async () => {
  assert.equal(
    await hmac("Jefe", "what do ya want for nothing?"),
    "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
  );
});

test("HMAC authenticates the exact event ID, timestamp and body bytes", async () => {
  const original = await hmac(
    "secret",
    "event-1" + "2026-10-28T10:00:00Z" + '{"a":1}',
  );
  for (const payload of [
    "event-2" + "2026-10-28T10:00:00Z" + '{"a":1}',
    "event-1" + "2026-10-28T10:00:01Z" + '{"a":1}',
    "event-1" + "2026-10-28T10:00:00Z" + '{ "a":1}',
  ])
    assert.notEqual(await hmac("secret", payload), original);
});

test("constant comparison handles mismatches and fixed-length signature values", () => {
  assert.equal(constantEqual("sha256=abcd", "sha256=abcd"), true);
  assert.equal(constantEqual("sha256=abcd", "sha256=abce"), false);
  assert.equal(constantEqual("sha256=abcd", "sha256=abc"), false);
  assert.equal(constantEqual("", ""), true);
});

test("random tokens are URL-safe, have requested entropy length, and do not repeat", () => {
  const tokens = Array.from({ length: 100 }, () => randomToken());
  assert.equal(new Set(tokens).size, 100);
  assert.ok(tokens.every((token) => /^[A-Za-z0-9_-]{43}$/.test(token)));
  assert.match(randomToken(18), /^[A-Za-z0-9_-]{24}$/);
});

test("AES-GCM encrypts JSON with a fresh nonce and round-trips Unicode", async () => {
  const data = {
    access_token: "private-access-token",
    refresh_token: "private-refresh-token",
    label: "Bubbles 🫧",
    expiresAt: 1234,
  };
  const first = await encrypt(data, key);
  const second = await encrypt(data, key);
  assert.notEqual(first, second);
  assert.equal(first.includes(data.access_token), false);
  assert.deepEqual(await decrypt(first, key), data);
});

test("AES-GCM rejects wrong keys, changed ciphertext, and changed nonces", async () => {
  const ciphertext = await encrypt({ token: "private" }, key);
  await assert.rejects(decrypt(ciphertext, otherKey));
  const bytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  bytes[bytes.length - 1] ^= 1;
  await assert.rejects(decrypt(btoa(String.fromCharCode(...bytes)), key));
  bytes[bytes.length - 1] ^= 1;
  bytes[0] ^= 1;
  await assert.rejects(decrypt(btoa(String.fromCharCode(...bytes)), key));
});

test("encryption rejects malformed or incorrectly sized keys", async () => {
  for (const invalid of [
    "not base64 !!!",
    btoa("too short"),
    btoa("x".repeat(33)),
  ])
    await assert.rejects(
      encrypt({ token: "private" }, invalid),
      /encryption key/,
    );
});

test("same-origin policy accepts the exact scheme, host and port only", () => {
  assert.doesNotThrow(() => sameOrigin(post("{}")));
  for (const origin of [
    "http://rallypoint.example",
    "https://evil.example",
    "https://rallypoint.example.evil.example",
    "https://rallypoint.example:444",
    "null",
  ]) {
    assert.throws(
      () => sameOrigin(post("{}", { Origin: origin })),
      (error: unknown) => error instanceof HttpError && error.status === 403,
    );
  }
  assert.throws(
    () =>
      sameOrigin(
        new Request(`${ORIGIN}/api/room`, { method: "POST", body: "{}" }),
      ),
    (error: unknown) => error instanceof HttpError && error.status === 403,
  );
});

test("streaming body limit counts UTF-8 bytes, not string length", async () => {
  assert.equal(await readLimited(post("🫧🫧"), 8), "🫧🫧");
  await assert.rejects(
    readLimited(post("🫧🫧"), 7),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );
});

test("body limit rejects oversized Content-Length before reading", async () => {
  await assert.rejects(
    readLimited(post("x", { "Content-Length": "1000" }), 20),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );
});

test("a false small Content-Length cannot bypass the streaming limit", async () => {
  await assert.rejects(
    readLimited(post("x".repeat(21), { "Content-Length": "1" }), 20),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );
});

test("reading without a body yields an empty string", async () => {
  assert.equal(await readLimited(new Request(`${ORIGIN}/api/room`), 10), "");
});

test("JSON parsing rejects invalid JSON and wrong media types with distinct statuses", async () => {
  assert.deepEqual(await readJson(post('{"type":"close"}')), { type: "close" });
  await assert.rejects(
    readJson(post("{broken")),
    (error: unknown) => error instanceof HttpError && error.status === 400,
  );
  await assert.rejects(
    readJson(post("{}", { "Content-Type": "text/plain" })),
    (error: unknown) => error instanceof HttpError && error.status === 415,
  );
  await assert.rejects(
    readJson(post("x".repeat(100)), 50),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );
});

test("cookie lookup matches exact names, tolerates spacing and preserves opaque values", () => {
  const request = new Request(ORIGIN, {
    headers: {
      Cookie: "other_rally_oauth=evil; rally_oauth=good-_token; preference=1",
    },
  });
  assert.equal(cookie(request, "rally_oauth"), "good-_token");
  assert.equal(cookie(request, "missing"), undefined);
  assert.equal(cookie(new Request(ORIGIN), "rally_oauth"), undefined);
});

test("JSON API responses prevent caching and MIME sniffing", async () => {
  const response = json({ active: true });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.deepEqual(await response.json(), { active: true });
});

test("server errors hide provider details and API failures never cache", async () => {
  const response = apiError(new HttpError(502, "PRIVATE provider diagnostic"));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.text()).includes("PRIVATE"), false);
  assert.equal(apiError(new HttpError(401, "Sign in")).status, 401);
  assert.equal(
    apiError(
      new HttpError(409, "The studio changed concurrently. Please try again."),
    ).status,
    409,
  );
  const unexpected = apiError(new Error("PRIVATE database diagnostic"));
  assert.equal(unexpected.status, 500);
  assert.equal((await unexpected.text()).includes("PRIVATE"), false);
});

// Exercise the actual webhook handler with only external boundaries replaced.
// TypeScript's installed compiler strips its types in memory; no generated files
// or cloud credentials are involved. Crypto and request validation stay real.
async function webhookHarness() {
  const { readFile } = await import("node:fs/promises");
  const ts = await import("typescript");
  const uri = (source: string) =>
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const harness: any = {
    mutations: [],
    flushes: [],
    writes: [],
    lookupCalls: 0,
    integrationRow: { owner_id: "owner-1", broadcaster_id: "broadcaster-1" },
    mutationError: null,
    changed: true,
  };
  harness.lookupOwner = async (broadcasterId: string) => {
    harness.lookupCalls++;
    return broadcasterId === "broadcaster-1" ? { owner_id: "owner-1" } : null;
  };
  harness.integration = async () => harness.integrationRow;
  harness.mutateRoom = async (...args: unknown[]) => {
    if (harness.mutationError) throw harness.mutationError;
    harness.mutations.push(args);
    return { changed: harness.changed, reply: harness.reply };
  };
  harness.flushReply = async (...args: unknown[]) => {
    harness.flushes.push(args);
  };
  harness.runtime = () => ({
    TWITCH_WEBHOOK_SECRET: "audit-webhook-secret",
    DB: {
      prepare: (query: string) => ({
        bind: (...values: unknown[]) => ({
          run: async () => {
            harness.writes.push({ query, values });
            return { success: true };
          },
        }),
      }),
    },
  });
  (globalThis as any).__rallyAuditHarness = harness;
  const transpile = (source: string) =>
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
  const securitySource = transpile(
    await readFile(
      new URL("../lib/server/security.ts", import.meta.url),
      "utf8",
    ),
  );
  harness.HttpError = (await import(uri(securitySource))).HttpError;
  const replacements: Record<string, string> = {
    "./security": uri(securitySource),
    "./rooms": uri(
      "export const mutateRoom=(...a)=>globalThis.__rallyAuditHarness.mutateRoom(...a); export const lookupOwner=(...a)=>globalThis.__rallyAuditHarness.lookupOwner(...a);",
    ),
    "./twitch": uri(
      "export const integration=(...a)=>globalThis.__rallyAuditHarness.integration(...a); export const flushReply=(...a)=>globalThis.__rallyAuditHarness.flushReply(...a);",
    ),
    "./env": uri(
      "export const runtime=()=>globalThis.__rallyAuditHarness.runtime();",
    ),
  };
  let source = transpile(
    await readFile(
      new URL("../lib/server/webhook.ts", import.meta.url),
      "utf8",
    ),
  );
  for (const [path, replacement] of Object.entries(replacements))
    source = source
      .replaceAll(`'${path}'`, `'${replacement}'`)
      .replaceAll(`"${path}"`, `"${replacement}"`);
  const module = await import(uri(source));
  const pending: Promise<unknown>[] = [];
  const handle = async (request: Request) => {
    const response = await module.handleWebhook(request, {
      waitUntil: (p: Promise<unknown>) => pending.push(p),
    });
    await Promise.all(pending.splice(0));
    return response as Response;
  };
  const signed = async (
    payload: unknown,
    options: {
      type?: string;
      id?: string;
      timestamp?: string;
      raw?: string;
    } = {},
  ) => {
    const raw = options.raw ?? JSON.stringify(payload);
    const messageId = options.id ?? "delivery-1";
    const timestamp = options.timestamp ?? new Date().toISOString();
    return new Request(`${ORIGIN}/api/twitch/webhook`, {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": messageId,
        "Twitch-Eventsub-Message-Timestamp": timestamp,
        "Twitch-Eventsub-Message-Type": options.type ?? "notification",
        "Twitch-Eventsub-Message-Signature": `sha256=${await hmac("audit-webhook-secret", messageId + timestamp + raw)}`,
      },
      body: raw,
    });
  };
  return { harness, handle, signed };
}
const chatPayload = (text = "!join A") => ({
  subscription: {
    id: "subscription-chat",
    type: "channel.chat.message",
    condition: {
      broadcaster_user_id: "broadcaster-1",
      user_id: "broadcaster-1",
    },
  },
  event: {
    broadcaster_user_id: "broadcaster-1",
    chatter_user_id: "viewer-1",
    chatter_user_name: "Viewer",
    message_id: "chat-message-1",
    message: { text },
  },
});

test("webhook rejects missing signatures, forged bodies and stale/future events before data access", async () => {
  const { harness, handle, signed } = await webhookHarness();
  assert.equal(
    (
      await handle(
        new Request(`${ORIGIN}/api/twitch/webhook`, {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
    403,
  );
  const signedRequest = await signed(chatPayload());
  const forged = new Request(signedRequest.url, {
    method: "POST",
    headers: signedRequest.headers,
    body: JSON.stringify(chatPayload("!join B")),
  });
  assert.equal((await handle(forged)).status, 403);
  for (const offset of [-601_000, 601_000])
    assert.equal(
      (
        await handle(
          await signed(chatPayload(), {
            timestamp: new Date(Date.now() + offset).toISOString(),
          }),
        )
      ).status,
      403,
    );
  assert.equal(harness.lookupCalls, 0);
  assert.equal(harness.mutations.length, 0);
});

test("webhook verifies a real signed callback challenge without exposing integration data", async () => {
  const { harness, handle, signed } = await webhookHarness();
  const response = await handle(
    await signed(
      { ...chatPayload(), challenge: "challenge-opaque-value" },
      { type: "webhook_callback_verification" },
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/plain");
  assert.equal(await response.text(), "challenge-opaque-value");
  assert.equal(harness.mutations.length, 0);
});

test("webhook drops cross-channel and shared-chat contributions", async () => {
  const { harness, handle, signed } = await webhookHarness();
  const otherBroadcaster = chatPayload();
  otherBroadcaster.event.broadcaster_user_id = "other-broadcaster";
  assert.equal((await handle(await signed(otherBroadcaster))).status, 204);
  const sharedChat = chatPayload();
  (sharedChat.event as any).source_broadcaster_user_id = "other-broadcaster";
  assert.equal((await handle(await signed(sharedChat))).status, 204);
  const wrongUser = chatPayload();
  wrongUser.subscription.condition.user_id = "other-bot";
  assert.equal((await handle(await signed(wrongUser))).status, 204);
  assert.equal(harness.mutations.length, 0);
});

test("webhook routes valid commands and drains pending outbox even on duplicate receipt", async () => {
  const { harness, handle, signed } = await webhookHarness();
  harness.changed = false;
  assert.equal(
    (await handle(await signed(chatPayload("!catchup")))).status,
    204,
  );
  assert.equal(harness.mutations.length, 1);
  assert.equal(harness.mutations[0][0], "owner-1");
  assert.equal(harness.mutations[0][1].text, "!catchup");
  assert.deepEqual(harness.mutations[0][2], {
    id: "delivery-1",
    parentId: "chat-message-1",
  });
  assert.deepEqual(harness.flushes, [["owner-1", "delivery-1"]]);
});

test("webhook never mutates room for ordinary chat", async () => {
  const { harness, handle, signed } = await webhookHarness();
  assert.equal(
    (await handle(await signed(chatPayload("hello everyone")))).status,
    204,
  );
  assert.equal(harness.mutations.length, 0);
});

test("webhook preserves signed raid time so delayed events cannot refresh the welcome window", async () => {
  const { harness, handle, signed } = await webhookHarness();
  const timestamp = new Date(Date.now() - 120_000).toISOString();
  const payload = {
    subscription: {
      id: "subscription-raid",
      type: "channel.raid",
      condition: { to_broadcaster_user_id: "broadcaster-1" },
    },
    event: {
      to_broadcaster_user_id: "broadcaster-1",
      from_broadcaster_user_name: "CozyCrew",
      viewers: 32,
    },
  };
  assert.equal(
    (await handle(await signed(payload, { timestamp }))).status,
    204,
  );
  assert.equal(harness.mutations[0][1].at, timestamp);
  assert.equal(harness.mutations[0][1].viewers, 32);
});

test("webhook requests Twitch retry for concurrency failures and hides malformed-event failures", async () => {
  const { harness, handle, signed } = await webhookHarness();
  harness.mutationError = new harness.HttpError(
    409,
    "The studio changed concurrently. Please try again.",
  );
  assert.equal((await handle(await signed(chatPayload()))).status, 503);
  harness.mutationError = new harness.HttpError(
    400,
    "PRIVATE_DIAGNOSTIC: invalid viewer ID",
  );
  const malformed = await handle(await signed(chatPayload()));
  assert.equal(malformed.status, 204);
  assert.equal((await malformed.text()).includes("PRIVATE_DIAGNOSTIC"), false);
  harness.mutationError = new Error("ARBITRARY_STORAGE_FAILURE");
  const unexpected = await handle(await signed(chatPayload()));
  assert.equal(unexpected.status, 503);
  assert.equal(
    (await unexpected.text()).includes("ARBITRARY_STORAGE_FAILURE"),
    false,
  );
});

test("webhook erases no tokens on revocation and flags only the owning integration", async () => {
  const { harness, handle, signed } = await webhookHarness();
  assert.equal(
    (await handle(await signed(chatPayload(), { type: "revocation" }))).status,
    204,
  );
  assert.equal(harness.mutations.length, 0);
  assert.equal(harness.writes.length, 1);
  assert.match(harness.writes[0].query, /UPDATE integrations/);
  assert.deepEqual(harness.writes[0].values, ["owner-1"]);
});
