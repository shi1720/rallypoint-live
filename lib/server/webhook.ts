import { mutateRoom, lookupOwner } from "./rooms";
import { integration } from "./twitch";
import { enqueueReply } from "./queue";
import { updateIntegrationError } from "./store";
import {
  constantEqual,
  hmac,
  readLimited,
  HttpError,
  isRecord,
} from "./security";
import { runtime } from "./env";
export async function handleWebhook(request: Request) {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const secret = runtime().TWITCH_WEBHOOK_SECRET;
  if (!secret)
    return new Response("Integration not configured", { status: 503 });
  const id = request.headers.get("Twitch-Eventsub-Message-Id") ?? "",
    time = request.headers.get("Twitch-Eventsub-Message-Timestamp") ?? "",
    signature = request.headers.get("Twitch-Eventsub-Message-Signature") ?? "",
    type = request.headers.get("Twitch-Eventsub-Message-Type");
  if (
    !id ||
    id.length > 200 ||
    !Number.isFinite(Date.parse(time)) ||
    Math.abs(Date.now() - Date.parse(time)) > 600000
  )
    return new Response("Invalid event", { status: 403 });
  let raw: string;
  try {
    raw = await readLimited(request, 65536);
  } catch {
    return new Response("Request too large", { status: 413 });
  }
  const computed = "sha256=" + (await hmac(secret, id + time + raw));
  if (!constantEqual(computed, signature))
    return new Response("Invalid signature", { status: 403 });
  let payload: Record<string, unknown>;
  try {
    const decoded: unknown = JSON.parse(raw);
    if (!isRecord(decoded))
      return new Response("Invalid JSON", { status: 400 });
    payload = decoded;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const sub = payload.subscription;
  if (!isRecord(sub) || !isRecord(sub.condition))
    return new Response("Invalid subscription", { status: 400 });
  const condition = sub.condition;
  const broadcaster =
    condition.broadcaster_user_id ?? condition.to_broadcaster_user_id;
  if (typeof broadcaster !== "string" || !broadcaster)
    return new Response(null, { status: 204 });
  const match = await lookupOwner(broadcaster);
  if (!match) return new Response(null, { status: 204 });
  const row = await integration(match.owner_id);
  if (!row) return new Response(null, { status: 204 });
  if (type === "webhook_callback_verification") {
    if (
      typeof payload.challenge !== "string" ||
      payload.challenge.length > 2000
    )
      return new Response("Invalid challenge", { status: 400 });
    return new Response(payload.challenge, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": String(
          new TextEncoder().encode(payload.challenge).byteLength,
        ),
      },
    });
  }
  if (type === "revocation") {
    await updateIntegrationError(
      match.owner_id,
      "Twitch revoked an event subscription. Reconnect Twitch.",
    );
    return new Response(null, { status: 204 });
  }
  if (type !== "notification")
    return new Response("Unsupported event", { status: 400 });
  const event = isRecord(payload.event) ? payload.event : null;
  const message = event && isRecord(event.message) ? event.message : null;
  try {
    if (
      sub.type === "channel.chat.message" &&
      event &&
      event.broadcaster_user_id === row.broadcaster_id &&
      condition.user_id === row.broadcaster_id
    ) {
      if (
        event.source_broadcaster_user_id &&
        event.source_broadcaster_user_id !== row.broadcaster_id
      )
        return new Response(null, { status: 204 });
      if (
        typeof message?.text !== "string" ||
        !/^!(join|vote|pitch|catchup)(\s|$)/i.test(message.text) ||
        typeof event.message_id !== "string" ||
        typeof event.chatter_user_id !== "string" ||
        typeof event.chatter_user_name !== "string"
      )
        return new Response(null, { status: 204 });
      await mutateRoom(
        match.owner_id,
        {
          type: "chat",
          messageId: event.message_id,
          userId: event.chatter_user_id,
          name: event.chatter_user_name,
          text: message.text,
          at: time,
        },
        { id, parentId: event.message_id },
      );
      await enqueueReply(match.owner_id, id);
    } else if (
      sub.type === "channel.raid" &&
      event &&
      event.to_broadcaster_user_id === row.broadcaster_id
    ) {
      if (
        typeof event.from_broadcaster_user_name !== "string" ||
        typeof event.viewers !== "number"
      )
        return new Response(null, { status: 204 });
      await mutateRoom(
        match.owner_id,
        {
          type: "raid",
          eventId: id,
          from: event.from_broadcaster_user_name,
          viewers: event.viewers,
          at: time,
        },
        { id },
      );
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    if (
      error instanceof HttpError &&
      error.status < 500 &&
      error.status !== 409
    )
      return new Response(null, { status: 204 });
    return new Response("Please retry", { status: 503 });
  }
}
