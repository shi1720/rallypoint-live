/** Actual Firebase Auth + deployed Next/Firestore checks. No real Twitch authorization is asserted. */
import assert from "node:assert/strict";
import { randomUUID, createHash, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
const origin = process.env.TEST_ORIGIN || "https://rallypoint-desk.web.app";
if (
  !/^https:\/\/rallypoint-(desk|studio)\.web\.app$/.test(origin) &&
  !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
)
  throw new Error("Use a designated Rallypoint test deployment.");
let checks = 0;
const fixtures = [];
function check(value, label) {
  assert.ok(value, label);
  console.log("PASS " + label);
  checks++;
}
async function api(path, { cookie, body, headers = {}, method } = {}) {
  const r = await fetch(origin + path, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined
        ? { "Content-Type": "application/json", Origin: origin }
        : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  let data;
  try {
    data = await r.json();
  } catch {
    data = {};
  }
  return { r, data };
}
const config = (await api("/api/auth/config")).data;
check(
  !!config.apiKey && !!config.appId,
  "public Firebase configuration is available",
);
async function guest() {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const auth = await r.json();
  assert.ok(r.ok, "Firebase guest authentication succeeds");
  fixtures.push({ uid: auth.localId });
  const session = await api("/api/auth/session", {
    body: { idToken: auth.idToken },
  });
  assert.equal(
    session.r.status,
    200,
    "Server verifies the actual Firebase token",
  );
  const header = session.r.headers.get("set-cookie");
  check(
    header?.startsWith("__session=") &&
      header.includes("HttpOnly") &&
      header.includes("Secure") &&
      header.includes("SameSite=Lax"),
    "session cookie uses Firebase-compatible secure properties",
  );
  return {
    uid: auth.localId,
    idToken: auth.idToken,
    cookie: header.split(";")[0],
  };
}
const project = config.projectId;
let cloudToken;
function cloudAccess() {
  return (cloudToken ??= execFileSync(
    "gcloud",
    ["auth", "print-access-token"],
    { encoding: "utf8" },
  ).trim());
}
const root = `https://firestore.googleapis.com/v1/projects/${project}/databases/rallypoint/documents`;
async function cloud(method, path, body) {
  const r = await fetch(root + path, {
    method,
    headers: {
      Authorization: "Bearer " + cloudAccess(),
      "x-goog-user-project": project,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 404)
    throw new Error(`Fixture operation failed (${r.status})`);
  return data;
}
function fields(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      typeof v === "number"
        ? { integerValue: String(v) }
        : v === null
          ? { nullValue: null }
          : { stringValue: String(v) },
    ]),
  );
}
let ownerA, ownerB, roomA, roomB, delivery;
try {
  check(
    (await api("/api/health")).data.status === "ok",
    "deployed server reaches its dedicated Firestore database",
  );
  check(
    (await api("/api/room")).r.status === 401,
    "anonymous studio requests are rejected",
  );
  check(
    (
      await api("/api/room", {
        headers: {
          "oai-authenticated-user-id": "spoof",
          "oai-authenticated-user-email": "spoof@example.invalid",
        },
      })
    ).r.status === 401,
    "old Sites identity headers cannot impersonate an owner",
  );
  check(
    (await api("/api/auth/session", { body: { idToken: "not-a-token" } })).r
      .status === 401,
    "forged Firebase tokens are rejected",
  );
  check(
    (
      await api("/api/auth/session", {
        body: { idToken: "bad" },
        headers: { Origin: "https://attacker.example" },
      })
    ).r.status === 403,
    "cross-origin session creation is rejected",
  );
  const badBodies = await Promise.all(
    [null, [], 42].map((body) => api("/api/auth/session", { body })),
  );
  check(
    badBodies.every(({ r }) => r.status === 400),
    "malformed session JSON returns validation errors rather than server failures",
  );
  ownerA = await guest();
  ownerB = await guest();
  roomA = (await api("/api/room", { cookie: ownerA.cookie })).data;
  roomB = (await api("/api/room", { cookie: ownerB.cookie })).data;
  // Firebase credential linking must preserve the existing workspace UID.
  const email = "rallypoint-fixture-" + randomUUID() + "@example.invalid",
    password = "Rp!" + randomUUID() + "9a";
  const linked = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: ownerB.idToken,
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );
  const linkedData = await linked.json();
  check(
    linked.ok && linkedData.localId === ownerB.uid,
    "linking a guest to email/password preserves its Firebase identity",
  );
  const login = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const loginData = await login.json();
  check(
    login.ok && loginData.localId === ownerB.uid,
    "email/password sign-in returns the same owner",
  );
  ownerB.idToken = loginData.idToken;
  const upgradedSession = await api("/api/auth/session", {
    body: { idToken: ownerB.idToken },
  });
  ownerB.cookie = upgradedSession.r.headers.get("set-cookie")?.split(";")[0];
  check(
    (await api("/api/room", { cookie: ownerB.cookie })).data.state.publicId ===
      roomB.state.publicId,
    "upgraded account keeps its saved workspace and public links",
  );
  const direct = await fetch(root + "/rooms/" + ownerA.uid, {
    headers: { Authorization: "Bearer " + ownerA.idToken },
  });
  check(
    direct.status === 403,
    "Firestore client rules reject direct private document access",
  );
  check(
    (await api("/api/public/not_a_real_room")).r.status === 404,
    "unknown viewer links return a clear missing-page response",
  );
  check(
    roomA.user.isAnonymous && roomA.state.brief.status === "draft",
    "new real guest workspace starts empty",
  );
  check(
    roomA.state.id !== roomB.state.id &&
      roomA.state.publicId !== roomB.state.publicId,
    "two authenticated owners get isolated durable workspaces",
  );
  check(
    roomA.publicUrl.startsWith(origin + "/watch/") &&
      roomA.overlayUrl.startsWith(origin + "/overlay/"),
    "public links use the canonical clean Firebase origin",
  );
  const brief = {
    title: "Deployment verification",
    context: "A disposable server test of the current decision.",
    stakes: "This fixture is removed when the test ends.",
    action: "Choose the bridge or tunnel in chat.",
    choices: [
      { id: "A", label: "Bridge" },
      { id: "B", label: "Tunnel" },
    ],
    expiresAt: new Date(Date.now() + 900000).toISOString(),
  };
  let result = await api("/api/room", {
    cookie: ownerA.cookie,
    body: {
      type: "publish",
      expectedVersion: roomA.state.brief.version,
      brief,
    },
  });
  check(
    result.r.status === 200,
    "authenticated publishing persists in real Firestore",
  );
  roomA = result.data;
  const view = await api("/api/public/" + roomA.state.publicId);
  check(
    view.data.state.proposals.length === 0 &&
      view.data.state.contributions.length === 0 &&
      view.data.state.cooldowns &&
      Object.keys(view.data.state.cooldowns).length === 0,
    "public projection contains no private queue or participant records",
  );
  check(
    view.data.state.chatReady === false,
    "an unconnected channel does not claim chat readiness",
  );
  check(
    (await api("/api/room", { cookie: ownerB.cookie })).data.state.brief
      .status === "draft",
    "one owner cannot alter another workspace",
  );
  check(
    (
      await api("/api/room", {
        cookie: ownerA.cookie,
        body: {
          type: "chat",
          messageId: "fake",
          userId: "fake",
          name: "fake",
          text: "!join A",
        },
      })
    ).r.status === 403,
    "real studio API rejects synthetic chat events",
  );
  const revision = roomA.state.revision;
  const publish = {
    type: "publish",
    expectedVersion: roomA.state.brief.version,
    brief: { ...brief, title: "Next chapter" },
  };
  const concurrent = await Promise.all([
    api("/api/room", { cookie: ownerA.cookie, body: publish }),
    api("/api/room", { cookie: ownerA.cookie, body: publish }),
  ]);
  check(
    concurrent.filter((x) => x.r.status === 200).length === 1 &&
      concurrent.filter((x) => x.r.status === 409).length === 1,
    "actual Firestore transactions reject a competing stale publisher",
  );
  roomA = concurrent.find((x) => x.r.status === 200).data;
  check(
    (
      await api("/api/room", {
        cookie: ownerA.cookie,
        body: { type: "close", expectedVersion: 1 },
      })
    ).r.status === 409,
    "stale close cannot end a newer published decision",
  );
  check(
    (
      await api("/api/room", {
        cookie: ownerA.cookie,
        body: { type: "reset", expectedRevision: revision },
      })
    ).r.status === 409,
    "stale reset cannot erase newer session data",
  );
  const visitor = "fixture_" + randomUUID();
  const open1 = await api("/api/public/" + roomA.state.publicId, {
      body: { visitorKey: visitor },
    }),
    open2 = await api("/api/public/" + roomA.state.publicId, {
      body: { visitorKey: visitor },
    });
  check(
    open1.data.counted === true && open2.data.counted === false,
    "page-open tracking deduplicates a browser without non-forwarded cookies",
  );
  // Authorized test-only integration. These are cryptographically signed fixtures, not live Twitch traffic.
  const broadcaster = "fixture-" + randomUUID(),
    channelKey = createHash("sha256").update(broadcaster).digest("hex");
  fixtures[0].broadcasterKey = channelKey;
  await cloud("PATCH", "/integrations/" + ownerA.uid, {
    fields: fields({
      owner_id: ownerA.uid,
      broadcaster_id: broadcaster,
      channel: "fixture_channel",
      encrypted_tokens: "test-only-no-real-token",
      scopes: "[]",
      subscription_ids: "[]",
      status: "connecting",
      error: null,
      updated_at: new Date().toISOString(),
    }),
  });
  await cloud("PATCH", "/channels/" + channelKey, {
    fields: fields({ owner_id: ownerA.uid }),
  });
  const secret = execFileSync(
    "gcloud",
    [
      "secrets",
      "versions",
      "access",
      "latest",
      "--secret=rallypoint-webhook-secret",
      "--project",
      project,
    ],
    { encoding: "utf8" },
  ).trim();
  delivery = randomUUID();
  fixtures[0].receiptKeys = [];
  const challenge = "rallypoint-signed-challenge-" + randomUUID(),
    challengeId = randomUUID(),
    challengeTime = new Date().toISOString(),
    challengeBody = JSON.stringify({
      challenge,
      subscription: {
        type: "channel.chat.message",
        condition: { broadcaster_user_id: broadcaster, user_id: broadcaster },
      },
    });
  const challengeResponse = await fetch(origin + "/api/twitch/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Twitch-Eventsub-Message-Id": challengeId,
      "Twitch-Eventsub-Message-Timestamp": challengeTime,
      "Twitch-Eventsub-Message-Type": "webhook_callback_verification",
      "Twitch-Eventsub-Message-Signature":
        "sha256=" + createHmac("sha256", secret)
          .update(challengeId + challengeTime + challengeBody)
          .digest("hex"),
    },
    body: challengeBody,
  });
  check(
    challengeResponse.status === 200 &&
      challengeResponse.headers.get("content-type") === "text/plain" &&
      challengeResponse.headers.get("content-length") ===
        String(Buffer.byteLength(challenge)) &&
      (await challengeResponse.text()) === challenge,
    "signed Twitch callback returns the raw challenge with the required byte length",
  );
  async function hook(
    valid = true,
    when = new Date().toISOString(),
    eventId = delivery,
    text = "!join A",
    messageId = delivery,
  ) {
    const payload = {
      subscription: {
        type: "channel.chat.message",
        condition: { broadcaster_user_id: broadcaster, user_id: broadcaster },
      },
      event: {
        broadcaster_user_id: broadcaster,
        chatter_user_id: "fixture-viewer",
        chatter_user_name: "Fixture participant",
        message_id: messageId,
        message: { text },
      },
    };
    const raw = JSON.stringify(payload);
    const signature =
      "sha256=" +
      createHmac("sha256", secret)
        .update(eventId + when + raw)
        .digest("hex");
    const r = await fetch(origin + "/api/twitch/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Twitch-Eventsub-Message-Id": eventId,
        "Twitch-Eventsub-Message-Timestamp": when,
        "Twitch-Eventsub-Message-Type": "notification",
        "Twitch-Eventsub-Message-Signature": valid
          ? signature
          : "sha256=invalid",
      },
      body: raw,
    });
    if (valid)
      fixtures[0].receiptKeys.push(
        createHash("sha256")
          .update(ownerA.uid + ":" + eventId)
          .digest("hex"),
      );
    return r;
  }
  check(
    (await hook(false)).status === 403,
    "hosted webhook rejects a forged signature",
  );
  check(
    (
      await hook(
        true,
        new Date(Date.now() - 660000).toISOString(),
        randomUUID(),
      )
    ).status === 403,
    "hosted webhook rejects an expired signed fixture",
  );
  check(
    (await hook()).status === 204,
    "signed fixture traverses the hosted webhook and real Firestore transaction",
  );
  await hook();
  await hook(true, new Date().toISOString(), randomUUID());
  const contributed = await api("/api/public/" + roomA.state.publicId);
  check(
    contributed.data.state.publicMetrics.currentContributors === 1 &&
      contributed.data.state.publicMetrics.counts.A === 1,
    "delivery and underlying message replay count only once",
  );
  check(
    !JSON.stringify(contributed.data.state).includes("fixture-viewer"),
    "hosted public results do not expose Twitch identities",
  );
  const malformedId = randomUUID(),
    malformedTime = new Date().toISOString(),
    malformedRaw = "null";
  const malformedWebhook = await fetch(origin + "/api/twitch/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Twitch-Eventsub-Message-Id": malformedId,
      "Twitch-Eventsub-Message-Timestamp": malformedTime,
      "Twitch-Eventsub-Message-Type": "notification",
      "Twitch-Eventsub-Message-Signature":
        "sha256=" +
        createHmac("sha256", secret)
          .update(malformedId + malformedTime + malformedRaw)
          .digest("hex"),
    },
    body: malformedRaw,
  });
  check(
    malformedWebhook.status === 400,
    "even signed malformed webhook JSON is rejected before data access",
  );
  const queuedDelivery = randomUUID();
  fixtures[0].outboxKeys = [
    createHash("sha256")
      .update(ownerA.uid + ":" + queuedDelivery)
      .digest("hex"),
  ];
  check(
    (
      await hook(
        true,
        new Date().toISOString(),
        queuedDelivery,
        "!catchup",
        queuedDelivery,
      )
    ).status === 204,
    "signed catch-up fixture commits an outbox item and reaches actual Cloud Tasks",
  );
  let workerState;
  for (let i = 0; i < 12; i++) {
    workerState = await cloud("GET", "/outbox/" + fixtures[0].outboxKeys[0]);
    if (workerState.fields?.status?.stringValue === "failed") break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  check(
    workerState.fields?.status?.stringValue === "failed" &&
      !!workerState.fields?.error?.stringValue,
    "actual queued worker processes the fixture and safely rejects its deliberately invalid Twitch credential",
  );
  check(
    (
      await api("/api/internal/outbox", {
        body: { owner: ownerA.uid, eventId: "absent" },
      })
    ).r.status === 403,
    "public callers cannot invoke the signed worker",
  );
  const workerSecret = execFileSync(
    "gcloud",
    [
      "secrets",
      "versions",
      "access",
      "latest",
      "--secret=rallypoint-token-key",
      "--project",
      project,
    ],
    { encoding: "utf8" },
  ).trim();
  const workerBody = { owner: ownerA.uid, eventId: "absent" };
  check(
    (
      await api("/api/internal/outbox", {
        body: workerBody,
        headers: {
          "X-Rallypoint-Task": createHmac("sha256", workerSecret)
            .update("rallypoint-outbox:" + JSON.stringify(workerBody))
            .digest("hex"),
        },
      })
    ).r.status === 204,
    "valid worker proofs accept an idempotent missing-item delivery",
  );
  const exportResult = await api("/api/export", { cookie: ownerA.cookie });
  check(
    exportResult.data.format === "rallypoint-export-v1" &&
      exportResult.r.headers.get("content-disposition")?.includes("attachment"),
    "authenticated export is downloadable",
  );
  const close = await api("/api/room", {
    cookie: ownerA.cookie,
    body: { type: "close", expectedVersion: roomA.state.brief.version },
  });
  check(
    close.r.status === 200 &&
      (await api("/api/public/" + roomA.state.publicId)).data.state.brief
        .status === "closed",
    "closing propagates to the real public snapshot",
  );
  const reset = await api("/api/room", {
    cookie: ownerA.cookie,
    body: { type: "reset", expectedRevision: close.data.state.revision },
  });
  check(
    reset.r.status === 200 &&
      reset.data.state.contributions.length === 0 &&
      reset.data.state.brief.version === close.data.state.brief.version,
    "session reset clears history while keeping versions monotonic",
  );
  check(
    (
      await api("/api/auth/signout", { cookie: ownerA.cookie, body: {} })
    ).r.headers
      .get("set-cookie")
      ?.includes("Max-Age=0"),
    "sign-out clears the server session",
  );
  const report = {
    passed: checks,
    origin,
    verifiedAt: new Date().toISOString(),
    actualFirebaseAuth: true,
    actualFirestore: true,
    actualCloudTasks: true,
    signedTwitchFixtures: true,
    liveTwitchVerified: false,
  };
  console.log(JSON.stringify(report));
  if (process.env.TEST_REPORT_FILE) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      process.env.TEST_REPORT_FILE,
      JSON.stringify(report, null, 2) + "\n",
    );
  }
} finally {
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i],
      room = i === 0 ? roomA : roomB;
    if (f.uid) {
      await cloud("DELETE", "/rooms/" + f.uid);
      await cloud("DELETE", "/integrations/" + f.uid);
      if (room?.state?.publicId)
        await cloud("DELETE", "/publicRooms/" + room.state.publicId);
      if (f.broadcasterKey)
        await cloud("DELETE", "/channels/" + f.broadcasterKey);
      for (const k of f.outboxKeys ?? []) await cloud("DELETE", "/outbox/" + k);
      for (const k of f.receiptKeys ?? [])
        await cloud("DELETE", "/receipts/" + k);
    }
    const tok = i === 0 ? ownerA?.idToken : ownerB?.idToken;
    if (tok)
      await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(config.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: tok }),
        },
      );
  }
}
