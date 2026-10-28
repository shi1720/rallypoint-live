import type { Connection } from "../rally/types";
import { configured, runtime, siteOrigin } from "./env";
import { decrypt, encrypt, HttpError } from "./security";
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
};
type Tokens = {
  access_token: string;
  refresh_token: string;
  expiresAt: number;
  validatedAt: number;
};
let appCache: { token: string; expiresAt: number; client: string } | null =
  null;
export async function integration(owner: string) {
  return runtime()
    .DB.prepare("SELECT * FROM integrations WHERE owner_id=?")
    .bind(owner)
    .first<Integration>();
}
export async function requestJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(7000),
  });
  let body: any;
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  if (!response.ok)
    throw new HttpError(
      502,
      `Twitch request failed (${response.status}). Reconnect or try again.`,
    );
  return body;
}
export async function appToken() {
  const e = runtime();
  if (!configured()) throw new HttpError(503, "Twitch is not configured yet.");
  if (
    appCache &&
    appCache.client === e.TWITCH_CLIENT_ID &&
    appCache.expiresAt > Date.now()
  )
    return appCache.token;
  const data = await requestJson("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: e.TWITCH_CLIENT_ID!,
      client_secret: e.TWITCH_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });
  appCache = {
    token: data.access_token,
    client: e.TWITCH_CLIENT_ID!,
    expiresAt: Date.now() + (data.expires_in - 120) * 1000,
  };
  return data.access_token as string;
}
export async function helix(
  path: string,
  token: string,
  init: RequestInit = {},
) {
  return requestJson(`https://api.twitch.tv/helix/${path}`, {
    ...init,
    headers: {
      "Client-Id": runtime().TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}
export async function saveAuthorization(
  owner: string,
  code: string,
  origin: string,
) {
  const e = runtime();
  const data = await requestJson("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: e.TWITCH_CLIENT_ID!,
      client_secret: e.TWITCH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${origin}/api/twitch/callback`,
    }),
  });
  const verified = await requestJson("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${data.access_token}` },
  });
  if (
    verified.client_id !== e.TWITCH_CLIENT_ID ||
    !verified.user_id ||
    SCOPES.some((scope) => !verified.scopes.includes(scope))
  )
    throw new HttpError(
      403,
      "Twitch authorization is missing required permissions.",
    );
  const tokens: Tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    validatedAt: Date.now(),
  };
  const encrypted = await encrypt(tokens, e.TOKEN_ENCRYPTION_KEY!);
  const previous = await integration(owner);
  if (previous && previous.broadcaster_id !== verified.user_id)
    throw new HttpError(
      409,
      "Disconnect the previous Twitch account before switching channels.",
    );
  const existing = await runtime()
    .DB.prepare("SELECT owner_id FROM integrations WHERE broadcaster_id=?")
    .bind(verified.user_id)
    .first<{ owner_id: string }>();
  if (existing && existing.owner_id !== owner)
    throw new HttpError(
      409,
      "This Twitch channel is already linked to another Rallypoint studio.",
    );
  await e.DB.prepare(
    "INSERT INTO integrations(owner_id,broadcaster_id,channel,encrypted_tokens,scopes,subscription_ids,status,error,updated_at) VALUES(?,?,?,?,?,'[]','connecting',NULL,?) ON CONFLICT(owner_id) DO UPDATE SET broadcaster_id=excluded.broadcaster_id,channel=excluded.channel,encrypted_tokens=excluded.encrypted_tokens,scopes=excluded.scopes,status='connecting',error=NULL,updated_at=excluded.updated_at",
  )
    .bind(
      owner,
      verified.user_id,
      verified.login,
      encrypted,
      JSON.stringify(verified.scopes),
      new Date().toISOString(),
    )
    .run();
  return verified.login as string;
}
export async function userToken(row: Integration): Promise<string> {
  const e = runtime();
  const stored = await decrypt<Tokens>(
    row.encrypted_tokens,
    e.TOKEN_ENCRYPTION_KEY!,
  );
  if (
    stored.expiresAt > Date.now() + 120000 &&
    stored.validatedAt > Date.now() - 3600000
  )
    return stored.access_token;
  if (stored.expiresAt > Date.now() + 120000) {
    try {
      const checked = await requestJson(
        "https://id.twitch.tv/oauth2/validate",
        { headers: { Authorization: `OAuth ${stored.access_token}` } },
      );
      if (
        checked.user_id !== row.broadcaster_id ||
        checked.client_id !== e.TWITCH_CLIENT_ID
      )
        throw new Error("Token identity mismatch.");
      stored.validatedAt = Date.now();
      await e.DB.prepare(
        "UPDATE integrations SET encrypted_tokens=? WHERE owner_id=? AND encrypted_tokens=?",
      )
        .bind(
          await encrypt(stored, e.TOKEN_ENCRYPTION_KEY!),
          row.owner_id,
          row.encrypted_tokens,
        )
        .run();
      return stored.access_token;
    } catch {
      /* Refresh revoked or expired access below. */
    }
  }
  try {
    const fresh = await requestJson("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: e.TWITCH_CLIENT_ID!,
        client_secret: e.TWITCH_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: stored.refresh_token,
      }),
    });
    const next: Tokens = {
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token,
      expiresAt: Date.now() + fresh.expires_in * 1000,
      validatedAt: Date.now(),
    };
    await e.DB.prepare(
      "UPDATE integrations SET encrypted_tokens=?,error=NULL,updated_at=? WHERE owner_id=? AND encrypted_tokens=?",
    )
      .bind(
        await encrypt(next, e.TOKEN_ENCRYPTION_KEY!),
        new Date().toISOString(),
        row.owner_id,
        row.encrypted_tokens,
      )
      .run();
    return next.access_token;
  } catch {
    await e.DB.prepare(
      "UPDATE integrations SET status='error',error='Authorization expired. Reconnect Twitch.' WHERE owner_id=?",
    )
      .bind(row.owner_id)
      .run();
    throw new HttpError(401, "Twitch authorization expired. Reconnect Twitch.");
  }
}
export async function subscriptions(owner: string, origin: string) {
  const row = await integration(owner);
  if (!row) throw new HttpError(409, "Connect a Twitch channel first.");
  const token = await appToken();
  const listing = await helix("eventsub/subscriptions?first=100", token);
  const target = `${origin}/api/twitch/webhook`;
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
    const found = listing.data?.find(
      (sub: any) =>
        sub.type === item.type &&
        (sub.condition.broadcaster_user_id ??
          sub.condition.to_broadcaster_user_id) === row.broadcaster_id &&
        sub.transport.callback === target &&
        ["enabled", "webhook_callback_verification_pending"].includes(
          sub.status,
        ),
    );
    if (found) {
      ids.push(found.id);
      continue;
    }
    const created = await helix("eventsub/subscriptions", token, {
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
    if (created.data?.[0]?.id) ids.push(created.data[0].id);
  }
  await runtime()
    .DB.prepare(
      "UPDATE integrations SET subscription_ids=?,status='connecting',error=NULL,updated_at=? WHERE owner_id=?",
    )
    .bind(JSON.stringify(ids), new Date().toISOString(), owner)
    .run();
}
export async function connectionFor(
  owner: string,
  request: Request,
  refresh = false,
): Promise<Connection> {
  const row = await integration(owner);
  const base = {
    configured: configured(),
    callbackUrl: `${siteOrigin(request)}/api/twitch/callback`,
    clientIdConfigured: !!runtime().TWITCH_CLIENT_ID,
  };
  if (!row) return { ...base, connected: false };
  let status = row.status,
    error = row.error;
  if (refresh && base.configured) {
    try {
      await userToken(row);
      const all = await helix(
        "eventsub/subscriptions?first=100",
        await appToken(),
      );
      const ids: string[] = JSON.parse(row.subscription_ids);
      const selected = all.data?.filter((x: any) => ids.includes(x.id)) ?? [];
      const chat = selected.find((x: any) => x.type === "channel.chat.message");
      const raid = selected.find((x: any) => x.type === "channel.raid");
      status =
        chat?.status === "enabled" && raid?.status === "enabled"
          ? "connected"
          : "connecting";
      error = selected.some(
        (x: any) =>
          !["enabled", "webhook_callback_verification_pending"].includes(
            x.status,
          ),
      )
        ? "Twitch revoked an event subscription. Reconnect."
        : null;
      await runtime()
        .DB.prepare(
          "UPDATE integrations SET status=?,error=?,updated_at=? WHERE owner_id=?",
        )
        .bind(status, error, new Date().toISOString(), owner)
        .run();
    } catch {
      status = "error";
      error = "Unable to verify Twitch. Reconnect or retry.";
    }
  }
  return {
    ...base,
    connected: status === "connected",
    channel: row.channel,
    broadcasterId: row.broadcaster_id,
    scopes: JSON.parse(row.scopes),
    updatedAt: row.updated_at,
    error: error ?? undefined,
    webhookStatus: status,
  };
}
export async function disconnect(owner: string) {
  const row = await integration(owner);
  if (!row) return;
  let cleanupError = false;
  try {
    const token = await appToken();
    for (const id of JSON.parse(row.subscription_ids)) {
      const response = await fetch(
        `https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            "Client-Id": runtime().TWITCH_CLIENT_ID!,
            Authorization: `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok && response.status !== 404) cleanupError = true;
    }
    const tokens = await decrypt<Tokens>(
      row.encrypted_tokens,
      runtime().TOKEN_ENCRYPTION_KEY!,
    );
    const revoked = await fetch("https://id.twitch.tv/oauth2/revoke", {
      method: "POST",
      body: new URLSearchParams({
        client_id: runtime().TWITCH_CLIENT_ID!,
        token: tokens.access_token,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!revoked.ok) cleanupError = true;
  } catch {
    cleanupError = true;
  }
  // Always erase the locally stored tokens; after this callbacks cannot mutate the room.
  await runtime().DB.batch([
    runtime()
      .DB.prepare("DELETE FROM integrations WHERE owner_id=?")
      .bind(owner),
    runtime().DB.prepare("DELETE FROM outbox WHERE owner_id=?").bind(owner),
  ]);
  return cleanupError;
}
export async function flushReply(owner: string, eventId: string) {
  const db = runtime().DB;
  const message = await db
    .prepare(
      "SELECT * FROM outbox WHERE id=? AND owner_id=? AND status='pending'",
    )
    .bind(eventId, owner)
    .first<{ reply: string; parent_id: string | null }>();
  if (!message) return;
  const claim = await db
    .prepare(
      "UPDATE outbox SET status='sending' WHERE id=? AND status='pending'",
    )
    .bind(eventId)
    .run();
  if (claim.meta.changes !== 1) return;
  try {
    const row = await integration(owner);
    if (!row) throw new Error("Disconnected.");
    const token = await userToken(row);
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
    if (!sent.data?.[0]?.is_sent)
      throw new Error("Twitch held or dropped the reply.");
    await db
      .prepare("UPDATE outbox SET status='sent',error=NULL WHERE id=?")
      .bind(eventId)
      .run();
  } catch {
    await db
      .prepare(
        "UPDATE outbox SET status='failed',error='Reply was not confirmed by Twitch. Not retried automatically to avoid duplicate chat.' WHERE id=?",
      )
      .bind(eventId)
      .run();
  }
}
