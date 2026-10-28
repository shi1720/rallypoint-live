import type { Connection, RallyState } from "../rally/types";
import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { configured, runtime, siteOrigin } from "./env";
import { decrypt, encrypt, HttpError, isRecord } from "./security";
import { docId, store } from "./store";

export const SCOPES = [
  "user:read:chat",
  "user:write:chat",
  "user:bot",
  "channel:bot",
];
export type Integration = {
  owner_id: string;
  broadcaster_id: string;
  channel: string;
  encrypted_tokens: string;
  scopes: string;
  subscription_ids: string;
  status: string;
  error: string | null;
  updated_at: string;
  authorization_id?: string;
  delivery_error?: string | null;
  refresh_lease?: { id: string; until: number } | null;
};
type Tokens = {
  access_token: string;
  refresh_token: string;
  expiresAt: number;
  validatedAt: number;
};
type Subscription = {
  id: string;
  type: string;
  status: string;
  condition: Record<string, unknown>;
  transport: Record<string, unknown>;
};
type Outbound = {
  owner_id: string;
  reply: string;
  parent_id?: string | null;
  status: string;
  created_at: string;
  public_id?: string;
  brief_version?: number;
  brief_expires_at?: string;
  expiresAt?: { toMillis(): number };
};
class TwitchRequestError extends HttpError {
  upstreamStatus: number;
  constructor(upstreamStatus: number) {
    super(502, `Twitch request failed (${upstreamStatus}). Try again shortly.`);
    this.upstreamStatus = upstreamStatus;
  }
}
const integrationRef = (owner: string) =>
  store().collection("integrations").doc(owner);
let appCache: { token: string; expiresAt: number; client: string } | null =
  null;
let appFlight: { client: string; promise: Promise<string> } | null = null;
export async function integration(owner: string): Promise<Integration | null> {
  const snapshot = await integrationRef(owner).get();
  return snapshot.exists ? (snapshot.data() as Integration) : null;
}
function stringList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
function tokenResult(data: unknown, fallbackRefresh?: string): Tokens {
  const response = isRecord(data) ? data : {};
  const refreshToken = response.refresh_token ?? fallbackRefresh;
  if (
    typeof response.access_token !== "string" ||
    !response.access_token ||
    typeof refreshToken !== "string" ||
    !refreshToken ||
    typeof response.expires_in !== "number" ||
    !Number.isFinite(response.expires_in) ||
    response.expires_in <= 0
  )
    throw new HttpError(
      502,
      "Twitch returned incomplete authorization data. Try connecting again.",
    );
  return {
    access_token: response.access_token,
    refresh_token: refreshToken,
    expiresAt: Date.now() + response.expires_in * 1000,
    validatedAt: Date.now(),
  };
}
function isSubscription(value: unknown): value is Subscription {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.status === "string" &&
    isRecord(value.condition) &&
    isRecord(value.transport)
  );
}
function authorizationMatches(a: Integration, b: Integration): boolean {
  return (
    a.broadcaster_id === b.broadcaster_id &&
    (a.authorization_id && b.authorization_id
      ? a.authorization_id === b.authorization_id
      : a.encrypted_tokens === b.encrypted_tokens)
  );
}
function transient(error: unknown): boolean {
  return error instanceof TwitchRequestError
    ? error.upstreamStatus === 429 || error.upstreamStatus >= 500
    : error instanceof HttpError && error.status >= 500;
}
export async function requestJson(
  url: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(7000)])
        : AbortSignal.timeout(7000),
    });
  } catch {
    throw new HttpError(502, "Twitch could not be reached. Try again shortly.");
  }
  if (!response.ok) throw new TwitchRequestError(response.status);
  try {
    const body: unknown = await response.json();
    if (!isRecord(body)) throw new Error("Expected a Twitch response object.");
    return body;
  } catch {
    throw new HttpError(
      502,
      "Twitch returned an unreadable response. Try again shortly.",
    );
  }
}
export async function appToken(): Promise<string> {
  const env = runtime();
  if (!configured()) throw new HttpError(503, "Twitch is not configured yet.");
  const client = env.TWITCH_CLIENT_ID!;
  if (appCache?.client === client && appCache.expiresAt > Date.now())
    return appCache.token;
  if (appFlight?.client === client) return appFlight.promise;
  const promise = (async () => {
    const data = await requestJson("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: client,
        client_secret: env.TWITCH_CLIENT_SECRET!,
        grant_type: "client_credentials",
      }),
    });
    if (
      typeof data?.access_token !== "string" ||
      !data.access_token ||
      typeof data.expires_in !== "number" ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0
    )
      throw new HttpError(502, "Twitch returned an invalid app authorization.");
    appCache = {
      token: data.access_token,
      client,
      expiresAt: Date.now() + Math.max(1, data.expires_in - 120) * 1000,
    };
    return data.access_token;
  })();
  appFlight = { client, promise };
  try {
    return await promise;
  } finally {
    if (appFlight?.promise === promise) appFlight = null;
  }
}
export async function helix(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const headers = new Headers(init.headers);
  headers.set("Client-Id", runtime().TWITCH_CLIENT_ID!);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return requestJson(`https://api.twitch.tv/helix/${path}`, {
    ...init,
    headers,
  });
}
export async function saveAuthorization(
  owner: string,
  code: string,
  origin: string,
): Promise<string> {
  const env = runtime();
  const data = await requestJson("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID!,
      client_secret: env.TWITCH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${origin}/api/twitch/callback`,
    }),
  });
  const tokens = tokenResult(data);
  const verified = await requestJson("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${tokens.access_token}` },
  });
  const { client_id: clientId, user_id: userId, login, scopes } = verified;
  if (
    clientId !== env.TWITCH_CLIENT_ID ||
    typeof userId !== "string" ||
    !/^\d+$/.test(userId) ||
    typeof login !== "string" ||
    !/^[a-z0-9_]{2,25}$/.test(login) ||
    !Array.isArray(scopes) ||
    SCOPES.some((scope) => !scopes.includes(scope))
  )
    throw new HttpError(
      403,
      "Twitch authorization is missing the required identity or permissions.",
    );
  const encrypted = await encrypt(tokens, env.TOKEN_ENCRYPTION_KEY!);
  const ref = integrationRef(owner),
    channelRef = store().collection("channels").doc(docId(userId));
  const saved = await store().runTransaction(async (tx) => {
    const [previousSnapshot, channelSnapshot] = await Promise.all([
      tx.get(ref),
      tx.get(channelRef),
    ]);
    const previous = previousSnapshot.exists
      ? (previousSnapshot.data() as Integration)
      : null;
    if (previous?.status === "disconnecting")
      throw new HttpError(
        409,
        "Twitch is disconnecting. Try connecting again in a moment.",
      );
    if (previous && previous.broadcaster_id !== userId)
      throw new HttpError(
        409,
        "Disconnect the previous Twitch account before switching channels.",
      );
    if (channelSnapshot.exists && channelSnapshot.data()?.owner_id !== owner)
      throw new HttpError(
        409,
        "This Twitch channel is already linked to another Rallypoint studio.",
      );
    const authorization: Integration = {
      owner_id: owner,
      broadcaster_id: userId,
      channel: login,
      encrypted_tokens: encrypted,
      scopes: JSON.stringify(scopes),
      subscription_ids: previous?.subscription_ids ?? "[]",
      status: "connecting",
      error: null,
      delivery_error: null,
      refresh_lease: null,
      authorization_id: crypto.randomUUID(),
      updated_at: new Date().toISOString(),
    };
    tx.set(ref, authorization);
    tx.set(channelRef, { owner_id: owner, broadcaster_id: userId });
    return authorization;
  });
  await syncPublicConnection(owner, false, saved);
  return login;
}

/** A short distributed lease prevents separate instances from rotating the same refresh token. */
export async function userToken(initial: Integration): Promise<string> {
  const ref = integrationRef(initial.owner_id),
    leaseId = crypto.randomUUID(),
    deadline = Date.now() + 6500;
  for (;;) {
    const claim = await store().runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists)
        throw new HttpError(
          401,
          "Twitch is disconnected. Connect the channel again.",
        );
      const row = snapshot.data() as Integration;
      if (
        row.status === "disconnecting" ||
        row.broadcaster_id !== initial.broadcaster_id
      )
        throw new HttpError(
          401,
          "Twitch is disconnecting or has changed. Refresh the studio.",
        );
      const tokens = await decrypt<Tokens>(
        row.encrypted_tokens,
        runtime().TOKEN_ENCRYPTION_KEY!,
      );
      if (
        typeof tokens?.access_token !== "string" ||
        !tokens.access_token ||
        typeof tokens.refresh_token !== "string" ||
        !tokens.refresh_token ||
        !Number.isFinite(tokens.expiresAt) ||
        !Number.isFinite(tokens.validatedAt)
      )
        throw new HttpError(
          401,
          "Stored Twitch authorization is invalid. Reconnect Twitch.",
        );
      if (
        tokens.expiresAt > Date.now() + 120000 &&
        tokens.validatedAt > Date.now() - 3600000
      )
        return { row, tokens, mode: "ready" as const };
      if (row.refresh_lease && row.refresh_lease.until > Date.now())
        return { row, tokens, mode: "wait" as const };
      tx.update(ref, {
        refresh_lease: { id: leaseId, until: Date.now() + 30000 },
      });
      return { row, tokens, mode: "claimed" as const };
    });
    if (claim.mode === "ready") return claim.tokens.access_token;
    if (claim.mode === "wait") {
      if (Date.now() >= deadline)
        throw new HttpError(
          503,
          "Twitch authorization is refreshing. Try again shortly.",
        );
      await new Promise((resolve) => setTimeout(resolve, 150));
      continue;
    }
    try {
      let next = claim.tokens;
      if (next.expiresAt > Date.now() + 120000) {
        try {
          const validated = await requestJson(
            "https://id.twitch.tv/oauth2/validate",
            { headers: { Authorization: `OAuth ${next.access_token}` } },
          );
          const scopes = validated.scopes;
          if (
            validated?.user_id !== claim.row.broadcaster_id ||
            validated?.client_id !== runtime().TWITCH_CLIENT_ID ||
            !Array.isArray(scopes) ||
            SCOPES.some((scope) => !scopes.includes(scope))
          )
            throw new HttpError(
              401,
              "Twitch authorization changed. Reconnect Twitch.",
            );
          next = { ...next, validatedAt: Date.now() };
        } catch (error) {
          if (
            !(
              error instanceof TwitchRequestError &&
              error.upstreamStatus === 401
            )
          )
            throw error;
          next = { ...next, expiresAt: 0 };
        }
      }
      if (next.expiresAt <= Date.now() + 120000) {
        const fresh = await requestJson("https://id.twitch.tv/oauth2/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: runtime().TWITCH_CLIENT_ID!,
            client_secret: runtime().TWITCH_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: next.refresh_token,
          }),
        });
        next = tokenResult(fresh, next.refresh_token);
      }
      const encrypted = await encrypt(next, runtime().TOKEN_ENCRYPTION_KEY!);
      const committed = await store().runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists)
          throw new HttpError(
            401,
            "Twitch was disconnected while authorization refreshed.",
          );
        const current = snapshot.data() as Integration;
        if (current.status === "disconnecting")
          throw new HttpError(401, "Twitch is disconnecting.");
        if (
          !authorizationMatches(current, claim.row) ||
          current.encrypted_tokens !== claim.row.encrypted_tokens ||
          current.refresh_lease?.id !== leaseId
        )
          return false;
        tx.update(ref, {
          encrypted_tokens: encrypted,
          refresh_lease: null,
          error: null,
          updated_at: new Date().toISOString(),
        });
        return true;
      });
      if (committed) return next.access_token;
      // A reconnect won the race. Read its current token rather than return ours.
      continue;
    } catch (error) {
      const revokedAuthorization = await store().runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) return null;
        const current = snapshot.data() as Integration;
        if (
          current.refresh_lease?.id !== leaseId ||
          !authorizationMatches(current, claim.row)
        )
          return null;
        const revoked =
          (error instanceof HttpError && error.status === 401) ||
          (error instanceof TwitchRequestError &&
            [400, 401].includes(error.upstreamStatus));
        tx.update(ref, {
          refresh_lease: null,
          ...(revoked
            ? {
                status: "error",
                error:
                  "Authorization expired or permissions changed. Reconnect Twitch.",
              }
            : {}),
        });
        return revoked ? { ...current, status: "error" } : null;
      });
      if (revokedAuthorization)
        await syncPublicConnection(
          initial.owner_id,
          false,
          revokedAuthorization,
        );
      if (
        error instanceof TwitchRequestError &&
        [400, 401].includes(error.upstreamStatus)
      )
        throw new HttpError(
          401,
          "Twitch authorization expired. Reconnect Twitch.",
        );
      throw error;
    }
  }
}

/** Traverse every page, bounded against malformed or repeating provider cursors. */
export async function listEventSubscriptions(
  token: string,
  signal?: AbortSignal,
): Promise<Subscription[]> {
  const results: Subscription[] = [],
    cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const query = new URLSearchParams({ first: "100" });
    if (cursor) query.set("after", cursor);
    const response = await helix(`eventsub/subscriptions?${query}`, token, {
      signal,
    });
    if (!Array.isArray(response?.data))
      throw new HttpError(502, "Twitch returned an invalid subscription list.");
    if (!response.data.every(isSubscription))
      throw new HttpError(502, "Twitch returned malformed subscription data.");
    results.push(...response.data);
    const pagination = response.pagination;
    const next = isRecord(pagination) ? pagination.cursor : undefined;
    if (next === undefined || next === null || next === "") return results;
    if (typeof next !== "string" || cursors.has(next))
      throw new HttpError(
        502,
        "Twitch subscription pagination could not be completed. Try again.",
      );
    cursors.add(next);
    cursor = next;
  }
  throw new HttpError(
    503,
    "Too many Twitch subscription pages. Try again shortly.",
  );
}
function subscriptionBelongsTo(sub: Subscription, row: Integration): boolean {
  return (
    ["channel.chat.message", "channel.raid"].includes(sub.type) &&
    (sub.condition?.broadcaster_user_id ??
      sub.condition?.to_broadcaster_user_id) === row.broadcaster_id &&
    (sub.type !== "channel.chat.message" ||
      sub.condition.user_id === row.broadcaster_id)
  );
}
export async function subscriptions(
  owner: string,
  origin: string,
): Promise<void> {
  const row = await integration(owner);
  if (!row || row.status === "disconnecting")
    throw new HttpError(409, "Connect a Twitch channel first.");
  const token = await appToken(),
    listing = await listEventSubscriptions(token),
    target = `${origin}/api/twitch/webhook`;
  const desired = [
    {
      type: "channel.chat.message",
      condition: {
        broadcaster_user_id: row.broadcaster_id,
        user_id: row.broadcaster_id,
      },
    },
    {
      type: "channel.raid",
      condition: { to_broadcaster_user_id: row.broadcaster_id },
    },
  ];
  const ids: string[] = [];
  for (const item of desired) {
    const found = listing.find(
      (sub) =>
        sub.type === item.type &&
        subscriptionBelongsTo(sub, row) &&
        sub.transport?.callback === target &&
        ["enabled", "webhook_callback_verification_pending"].includes(
          sub.status,
        ),
    );
    if (found) {
      ids.push(found.id);
      continue;
    }
    let created: Record<string, unknown>;
    try {
      created = await helix("eventsub/subscriptions", token, {
        method: "POST",
        body: JSON.stringify({
          ...item,
          version: "1",
          transport: {
            method: "webhook",
            callback: target,
            secret: runtime().TWITCH_WEBHOOK_SECRET!,
          },
        }),
      });
    } catch (error) {
      // Two setup requests can race after listing the same empty page. Reuse
      // the winner's subscription rather than present a spurious failure.
      if (
        !(error instanceof TwitchRequestError && error.upstreamStatus === 409)
      )
        throw error;
      const winner = (await listEventSubscriptions(token)).find(
        (sub) =>
          sub.type === item.type &&
          subscriptionBelongsTo(sub, row) &&
          sub.transport?.callback === target &&
          ["enabled", "webhook_callback_verification_pending"].includes(
            sub.status,
          ),
      );
      if (!winner) throw error;
      ids.push(winner.id);
      continue;
    }
    const subscription: unknown = Array.isArray(created.data)
      ? created.data[0]
      : undefined;
    if (!isRecord(subscription) || typeof subscription.id !== "string")
      throw new HttpError(
        502,
        "Twitch did not confirm event setup. Retry in Channel setup.",
      );
    ids.push(subscription.id);
  }
  const pending = await store().runTransaction(async (tx) => {
    const ref = integrationRef(owner),
      current = await tx.get(ref);
    if (
      !current.exists ||
      current.data()?.status === "disconnecting" ||
      !authorizationMatches(current.data() as Integration, row)
    )
      throw new HttpError(
        409,
        "Twitch authorization changed during event setup. Refresh and retry.",
      );
    tx.update(ref, {
      subscription_ids: JSON.stringify(ids),
      status: "connecting",
      error: null,
      updated_at: new Date().toISOString(),
    });
    return { ...current.data(), status: "connecting" } as Integration;
  });
  await syncPublicConnection(owner, false, pending);
}
/** Keep public participation honest without writing an unchanged view every poll. */
export async function syncPublicConnection(
  owner: string,
  ready: boolean,
  expected?: Integration | null,
): Promise<void> {
  const db = store();
  await db.runTransaction(async (tx) => {
    const room = await tx.get(db.collection("rooms").doc(owner));
    const publicId = room.data()?.public_id;
    if (!room.exists || typeof publicId !== "string" || !publicId) return;
    const publicRef = db.collection("publicRooms").doc(publicId);
    const [view, current] = await Promise.all([
      tx.get(publicRef),
      tx.get(integrationRef(owner)),
    ]);
    const document = view.data();
    if (!view.exists || document?.owner_id !== owner || !document.state) return;
    if (expected === null && current.exists) return;
    if (
      expected &&
      (!current.exists ||
        !authorizationMatches(current.data() as Integration, expected) ||
        current.data()?.status !== expected.status)
    )
      return;
    // An in-flight verification must never restore invitations after disconnect.
    const chatReady =
      ready && current.exists && current.data()?.status === "connected";
    if (document.state.chatReady !== chatReady)
      tx.update(publicRef, { state: { ...document.state, chatReady } });
  });
}
export async function connectionFor(
  owner: string,
  request: Request,
  refresh = false,
): Promise<Connection> {
  let row = await integration(owner);
  const base = {
    configured: configured(),
    callbackUrl: `${siteOrigin(request)}/api/twitch/callback`,
    clientIdConfigured: !!runtime().TWITCH_CLIENT_ID,
  };
  if (!row) {
    if (refresh) await syncPublicConnection(owner, false, null);
    return { ...base, connected: false };
  }
  let status = row.status,
    error = row.error;
  if (refresh && base.configured && status !== "disconnecting") {
    try {
      await userToken(row);
      const all = await listEventSubscriptions(await appToken()),
        ids = stringList(row.subscription_ids);
      const selected = all.filter(
        (sub) => ids.includes(sub.id) && subscriptionBelongsTo(sub, row!),
      );
      const chat = selected.find((sub) => sub.type === "channel.chat.message"),
        raid = selected.find((sub) => sub.type === "channel.raid");
      status =
        chat?.status === "enabled" && raid?.status === "enabled"
          ? "connected"
          : "connecting";
      error = selected.some(
        (sub) =>
          !["enabled", "webhook_callback_verification_pending"].includes(
            sub.status,
          ),
      )
        ? "Twitch revoked an event subscription. Reconnect."
        : null;
      const original = row;
      const retained = await store().runTransaction(async (tx) => {
        const ref = integrationRef(owner),
          snapshot = await tx.get(ref);
        if (
          !snapshot.exists ||
          !authorizationMatches(snapshot.data() as Integration, original) ||
          snapshot.data()?.status === "disconnecting"
        )
          return null;
        tx.update(ref, { status, error, updated_at: new Date().toISOString() });
        return { ...snapshot.data(), status, error } as Integration;
      });
      if (!retained) {
        await syncPublicConnection(owner, false, row);
        return {
          ...base,
          connected: false,
          error: "Twitch authorization changed. Refresh the studio.",
        };
      }
      row = retained;
    } catch {
      status = "error";
      error = "Unable to verify Twitch. Reconnect or retry.";
    }
  }
  const ready = base.configured && status === "connected";
  if (refresh) await syncPublicConnection(owner, ready, row);
  return {
    ...base,
    connected: ready,
    channel: row.channel,
    broadcasterId: row.broadcaster_id,
    scopes: stringList(row.scopes),
    updatedAt: row.updated_at,
    error: error ?? row.delivery_error ?? undefined,
    webhookStatus: status,
  };
}
export async function disconnect(owner: string): Promise<boolean | undefined> {
  const ref = integrationRef(owner);
  const row = await store().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return null;
    const current = snapshot.data() as Integration;
    tx.update(ref, {
      status: "disconnecting",
      refresh_lease: null,
      updated_at: new Date().toISOString(),
    });
    return current;
  });
  await syncPublicConnection(
    owner,
    false,
    row ? { ...row, status: "disconnecting" } : null,
  );
  if (!row) return;
  let cleanupError = false;
  const cleanupSignal = AbortSignal.timeout(15000);
  try {
    const token = await appToken(),
      tracked = new Set(stringList(row.subscription_ids));
    try {
      for (const sub of await listEventSubscriptions(token, cleanupSignal))
        if (subscriptionBelongsTo(sub, row)) tracked.add(sub.id);
    } catch {
      cleanupError = true;
    }
    for (const id of tracked) {
      if (cleanupSignal.aborted) {
        cleanupError = true;
        break;
      }
      try {
        const response = await fetch(
          `https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: {
              "Client-Id": runtime().TWITCH_CLIENT_ID!,
              Authorization: `Bearer ${token}`,
            },
            signal: AbortSignal.any([cleanupSignal, AbortSignal.timeout(5000)]),
          },
        );
        if (!response.ok && response.status !== 404) cleanupError = true;
      } catch {
        cleanupError = true;
      }
    }
  } catch {
    cleanupError = true;
  }
  // Revoke even when listing/deleting subscriptions failed.
  try {
    const tokens = await decrypt<Tokens>(
      row.encrypted_tokens,
      runtime().TOKEN_ENCRYPTION_KEY!,
    );
    const response = await fetch("https://id.twitch.tv/oauth2/revoke", {
      method: "POST",
      body: new URLSearchParams({
        client_id: runtime().TWITCH_CLIENT_ID!,
        token: tokens.access_token,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) cleanupError = true;
  } catch {
    cleanupError = true;
  }
  await store().runTransaction(async (tx) => {
    const channelRef = store()
      .collection("channels")
      .doc(docId(row.broadcaster_id));
    const [current, channel] = await Promise.all([
      tx.get(ref),
      tx.get(channelRef),
    ]);
    if (
      current.exists &&
      authorizationMatches(current.data() as Integration, row)
    )
      tx.delete(ref);
    if (channel.exists && channel.data()?.owner_id === owner)
      tx.delete(channelRef);
  });
  // Bound each batch and the cleanup duration. Remaining old rows expire by TTL.
  for (let page = 0; page < 10; page++) {
    const pending = await store()
      .collection("outbox")
      .where("owner_id", "==", owner)
      .limit(400)
      .get();
    if (pending.empty) return cleanupError;
    const batch = store().batch();
    for (const document of pending.docs) batch.delete(document.ref);
    await batch.commit();
  }
  return true;
}
async function invitationIsCurrent(
  message: Outbound,
  owner: string,
  transaction?: Transaction,
): Promise<boolean> {
  if (!/^NOW:|!(?:join|vote|pitch)\b/i.test(message.reply)) return true;
  const read = (ref: DocumentReference) =>
    transaction ? transaction.get(ref) : ref.get();
  let publicId = message.public_id;
  if (!publicId) {
    const room = await read(store().collection("rooms").doc(owner));
    if (!room.exists) return false;
    publicId = room.get("public_id");
  }
  if (typeof publicId !== "string" || !publicId) return false;
  const publication = await read(
    store().collection("publicRooms").doc(publicId),
  );
  const state = publication.get("state") as RallyState | undefined;
  return (
    publication.exists &&
    publication.get("owner_id") === owner &&
    !!state &&
    state.brief.version === message.brief_version &&
    state.brief.status === "live" &&
    Date.parse(state.brief.expiresAt) > Date.now()
  );
}
export async function flushReply(
  owner: string,
  eventId: string,
): Promise<void> {
  const ref = store()
    .collection("outbox")
    .doc(docId(owner + ":" + eventId));
  const message = await store().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return null;
    const current = snapshot.data() as Outbound;
    if (current.owner_id !== owner) return null;
    if (current.status === "sending") {
      if (
        !Number.isFinite(Date.parse(current.created_at)) ||
        Date.now() - Date.parse(current.created_at) > 60000
      ) {
        const connection = await tx.get(integrationRef(owner));
        const detail =
          "A previous chat delivery could not be confirmed. It will not be resent automatically.";
        tx.update(ref, { status: "failed", error: detail });
        if (connection.exists)
          tx.update(integrationRef(owner), { delivery_error: detail });
        return null;
      }
      // A concurrent queue delivery must not acknowledge a task whose first
      // attempt may still fail safely before it reaches Twitch.
      throw new HttpError(
        503,
        "This reply is already being delivered. Retry after the in-flight attempt finishes.",
      );
    }
    if (current.status !== "pending") return null;
    const createdAt = Date.parse(current.created_at),
      expiresAt = current.expiresAt?.toMillis();
    const stale =
      !Number.isFinite(createdAt) ||
      Date.now() - createdAt > 60000 ||
      createdAt > Date.now() + 60000 ||
      (expiresAt !== undefined && expiresAt <= Date.now()) ||
      !(await invitationIsCurrent(current, owner, tx));
    if (stale) {
      const connection = await tx.get(integrationRef(owner));
      const detail =
        "An old chat reply was suppressed after its context changed. New replies will use the current brief.";
      tx.update(ref, { status: "failed", error: detail });
      if (connection.exists)
        tx.update(integrationRef(owner), { delivery_error: detail });
      return null;
    }
    tx.update(ref, { status: "sending", error: null });
    return current;
  });
  if (!message) return;
  let sendAttempted = false;
  try {
    const row = await integration(owner);
    if (!row || row.status === "disconnecting")
      throw new HttpError(401, "Twitch is disconnected.");
    const token = await userToken(row);
    // Token renewal can take several seconds. Check again immediately before sending.
    if (!(await invitationIsCurrent(message, owner)))
      throw new HttpError(
        409,
        "The queued reply was superseded by a newer or closed brief.",
      );
    sendAttempted = true;
    const sent = await helix("chat/messages", token, {
      method: "POST",
      body: JSON.stringify({
        broadcaster_id: row.broadcaster_id,
        sender_id: row.broadcaster_id,
        message: message.reply,
        ...(message.parent_id
          ? { reply_parent_message_id: message.parent_id }
          : {}),
      }),
    });
    const confirmation: unknown = Array.isArray(sent.data)
      ? sent.data[0]
      : undefined;
    if (!isRecord(confirmation) || confirmation.is_sent !== true)
      throw new HttpError(409, "Twitch held or dropped the reply.");
    await store().runTransaction(async (tx) => {
      const snapshot = await tx.get(ref),
        connection = await tx.get(integrationRef(owner));
      if (snapshot.exists) tx.update(ref, { status: "sent", error: null });
      if (
        connection.exists &&
        authorizationMatches(connection.data() as Integration, row)
      )
        tx.update(integrationRef(owner), { delivery_error: null });
    });
  } catch (error) {
    const retrySafe = !sendAttempted && transient(error);
    const detail = retrySafe
      ? "Chat delivery is waiting for Twitch to recover. Retrying shortly."
      : !sendAttempted && error instanceof HttpError
        ? error.message
        : "A chat reply was not confirmed by Twitch. It will not be resent automatically.";
    await store().runTransaction(async (tx) => {
      const [snapshot, connection] = await Promise.all([
        tx.get(ref),
        tx.get(integrationRef(owner)),
      ]);
      if (snapshot.exists)
        tx.update(ref, {
          status: retrySafe ? "pending" : "failed",
          error: detail,
        });
      if (connection.exists)
        tx.update(integrationRef(owner), { delivery_error: detail });
    });
    if (retrySafe)
      throw new HttpError(
        503,
        "Twitch is temporarily unavailable. Retry this pending reply.",
      );
  }
}
