/** Run against npm run dev AFTER local D1 migrations. Uses only disposable LOCAL data. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import { createState } from "../lib/rally/engine.ts";
const origin = process.env.TEST_ORIGIN ?? "http://127.0.0.1:5173";
assert.ok(
  /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin),
  "Smoke test is local-only.",
);
let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks++;
  console.log("PASS " + label);
}
async function call(path, options = {}) {
  const response = await fetch(origin + path, options);
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { response, data };
}
const unauth = await call("/api/room");
check(unauth.response.status === 401, "anonymous studio access denied");
const signin = await fetch(
  origin + "/signin-with-chatgpt?return_to=%2Fstudio",
  { redirect: "manual" },
);
const cookie = signin.headers.get("set-cookie").split(";")[0];
const headers = {
  Cookie: cookie,
  "Content-Type": "application/json",
  Origin: origin,
};
let { data: room } = await call("/api/room", { headers });
check(
  !!room.state.id && room.connection.connected === false,
  "real studio opens with honest disconnected status",
);
const missingOrigin = await call("/api/room", {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: '{"type":"close"}',
});
check(
  missingOrigin.response.status === 403,
  "write without same-origin proof denied",
);
const synthetic = await call("/api/room", {
  method: "POST",
  headers,
  body: JSON.stringify({
    type: "chat",
    messageId: "fake",
    userId: "fake",
    name: "fake",
    text: "!join A",
  }),
});
check(
  synthetic.response.status === 403,
  "synthetic Twitch events forbidden in real studio",
);
const invalid = await call("/api/room", {
  method: "POST",
  headers,
  body: JSON.stringify({ type: "publish", brief: { title: "x" } }),
});
check(invalid.response.status === 400, "malformed publish rejected");
const brief = {
  title: "Integration test rescue",
  context: "A disposable local test of the real server.",
  stakes: "No viewer data involved.",
  action: "Choose !join A or !join B.",
  choices: [
    { id: "A", label: "Bridge" },
    { id: "B", label: "Tunnel" },
  ],
  expiresAt: new Date(Date.now() + 600000).toISOString(),
};
const publish = {
  type: "publish",
  brief,
  expectedVersion: room.state.brief.version,
};
const pair = await Promise.all([
  call("/api/room", { method: "POST", headers, body: JSON.stringify(publish) }),
  call("/api/room", { method: "POST", headers, body: JSON.stringify(publish) }),
]);
check(
  pair.filter((r) => r.response.status === 200).length === 1 &&
    pair.some((r) => r.response.status === 409),
  "concurrent stale editors cannot overwrite a new chapter",
);
room = pair.find((r) => r.response.status === 200).data;
const publicPage = await call("/api/public/" + room.state.publicId);
check(
  publicPage.response.status === 200 &&
    publicPage.data.state.creator === "" &&
    publicPage.data.state.processedIds.length === 0,
  "public projection strips private studio information",
);
const exportData = await call("/api/export", { headers });
check(
  exportData.data.format === "rallypoint-export-v1",
  "authenticated export works",
);
const closed = await call("/api/room", {
  method: "POST",
  headers,
  body: '{"type":"close"}',
});
check(
  closed.data.state.brief.status === "closed",
  "closing chapter persists server-side",
);
const secret = "rallypoint-local-test-secret-not-for-production";
const fixtureId = randomUUID(),
  owner = "http-fixture-" + fixtureId,
  publicId = "http_fixture_" + fixtureId.replaceAll("-", "");
const state = createState({
  id: fixtureId,
  publicId,
  channel: "fixturechannel",
  creator: "Local fixture",
});
let live = {
  ...state,
  brief: {
    ...brief,
    status: "live",
    version: 1,
    publishedAt: new Date().toISOString(),
  },
};
function sql(v) {
  return "'" + String(v).replaceAll("'", "''") + "'";
}
function db(sqlText) {
  writeFileSync("work/http-fixture.sql", sqlText);
  execFileSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "dist/server/wrangler.json",
      "--persist-to",
      ".wrangler/state",
      "--file",
      "work/http-fixture.sql",
    ],
    { stdio: "pipe" },
  );
}
db(
  `INSERT INTO rooms(id,owner_id,public_id,revision,state,updated_at) VALUES(${sql(fixtureId)},${sql(owner)},${sql(publicId)},0,${sql(JSON.stringify(live))},${sql(state.updatedAt)}); INSERT INTO integrations(owner_id,broadcaster_id,channel,encrypted_tokens,scopes,subscription_ids,status,updated_at) VALUES(${sql(owner)},${sql(fixtureId)},'fixturechannel','test-only','[]','[]','connecting',${sql(state.updatedAt)});`,
);
async function hook(
  type,
  event,
  messageId = randomUUID(),
  time = new Date().toISOString(),
  valid = true,
) {
  const body = JSON.stringify({
    subscription: {
      type,
      condition:
        type === "channel.raid"
          ? { to_broadcaster_user_id: fixtureId }
          : { broadcaster_user_id: fixtureId, user_id: fixtureId },
    },
    event,
  });
  const signature =
    "sha256=" +
    createHmac("sha256", secret)
      .update(messageId + time + body)
      .digest("hex");
  return fetch(origin + "/api/twitch/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Twitch-Eventsub-Message-Id": messageId,
      "Twitch-Eventsub-Message-Timestamp": time,
      "Twitch-Eventsub-Message-Signature": valid ? signature : "sha256=invalid",
      "Twitch-Eventsub-Message-Type": "notification",
    },
    body,
  });
}
try {
  const event = {
    broadcaster_user_id: fixtureId,
    chatter_user_id: "viewer-fixture",
    chatter_user_name: "Fixture viewer",
    message_id: randomUUID(),
    message: { text: "!join A" },
  };
  const delivery = randomUUID();
  const forged = await hook(
    "channel.chat.message",
    event,
    randomUUID(),
    new Date().toISOString(),
    false,
  );
  check(forged.status === 403, "forged webhook rejected");
  const stale = await hook(
    "channel.chat.message",
    event,
    randomUUID(),
    new Date(Date.now() - 660000).toISOString(),
  );
  check(stale.status === 403, "webhook older than ten minutes rejected");
  const accepted = await hook("channel.chat.message", event, delivery);
  check(
    accepted.status === 204,
    "signed Twitch-shaped command accepted through actual Worker ingress",
  );
  await hook("channel.chat.message", event, delivery);
  await hook("channel.chat.message", event, randomUUID());
  const result = await call("/api/public/" + publicId);
  check(
    result.data.state.publicMetrics.currentContributors === 1,
    "delivery and underlying chat-message replay do not duplicate votes",
  );
  check(
    result.data.state.contributions.length === 0 &&
      !JSON.stringify(result.data.state).includes("viewer-fixture"),
    "webhook contribution remains anonymous on public API",
  );
  const oldRaid = await hook(
    "channel.raid",
    {
      to_broadcaster_user_id: fixtureId,
      from_broadcaster_user_name: "FixtureRaid",
      viewers: 12,
    },
    randomUUID(),
    new Date(Date.now() - 120000).toISOString(),
  );
  const raidState = await call("/api/public/" + publicId);
  check(
    oldRaid.status === 204 &&
      Date.parse(raidState.data.state.raids[0].welcomeUntil) < Date.now(),
    "late raid delivery cannot restart an expired welcome",
  );
} catch (e) {
  throw e;
} finally {
  db(
    `DELETE FROM event_receipts WHERE owner_id=${sql(owner)}; DELETE FROM outbox WHERE owner_id=${sql(owner)}; DELETE FROM integrations WHERE owner_id=${sql(owner)}; DELETE FROM rooms WHERE owner_id=${sql(owner)};`,
  );
}
console.log(`${checks} HTTP integration checks passed.`);
