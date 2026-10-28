import { mutateRoom, lookupOwner } from "./rooms";
import { integration, flushReply } from "./twitch";
import { constantEqual, hmac, readLimited, HttpError } from "./security";
import { runtime } from "./env";
export async function handleWebhook(
  request: Request,
  ctx: { waitUntil: (p: Promise<unknown>) => void },
) {
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
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const sub = payload.subscription;
  if (!sub?.condition)
    return new Response("Invalid subscription", { status: 400 });
  const broadcaster =
    sub.condition.broadcaster_user_id ?? sub.condition.to_broadcaster_user_id;
  if (!broadcaster) return new Response(null, { status: 204 });
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
      headers: { "Content-Type": "text/plain" },
    });
  }
  if (type === "revocation") {
    await runtime()
      .DB.prepare(
        "UPDATE integrations SET status='error',error='Twitch revoked an event subscription. Reconnect Twitch.' WHERE owner_id=?",
      )
      .bind(match.owner_id)
      .run();
    return new Response(null, { status: 204 });
  }
  if (type !== "notification")
    return new Response("Unsupported event", { status: 400 });
  const event = payload.event;
  try {
    if (
      sub.type === "channel.chat.message" &&
      event?.broadcaster_user_id === row.broadcaster_id &&
      sub.condition.user_id === row.broadcaster_id
    ) {
      if (
        event.source_broadcaster_user_id &&
        event.source_broadcaster_user_id !== row.broadcaster_id
      )
        return new Response(null, { status: 204 });
      if (
        typeof event.message?.text !== "string" ||
        !/^!(join|vote|pitch|catchup)(\s|$)/i.test(event.message.text)
      )
        return new Response(null, { status: 204 });
      const result = await mutateRoom(
        match.owner_id,
        {
          type: "chat",
          messageId: event.message_id,
          userId: event.chatter_user_id,
          name: event.chatter_user_name,
          text: event.message.text,
          at: time,
        },
        { id, parentId: event.message_id },
      );
      ctx.waitUntil(flushReply(match.owner_id, id));
    } else if (
      sub.type === "channel.raid" &&
      event?.to_broadcaster_user_id === row.broadcaster_id
    ) {
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
