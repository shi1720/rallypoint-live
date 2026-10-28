import {
  constantEqual,
  hmac,
  readLimited,
} from "../../../../lib/server/security";
import { runtime } from "../../../../lib/server/env";
import { flushReply } from "../../../../lib/server/twitch";
export async function POST(request: Request) {
  const secret = runtime().TOKEN_ENCRYPTION_KEY;
  if (!secret) return new Response(null, { status: 503 });
  let raw: string;
  try {
    raw = await readLimited(request, 2000);
  } catch {
    return new Response(null, { status: 413 });
  }
  const expected = await hmac(secret, "rallypoint-outbox:" + raw);
  if (!constantEqual(expected, request.headers.get("X-Rallypoint-Task") ?? ""))
    return new Response(null, { status: 403 });
  try {
    const { owner, eventId } = JSON.parse(raw);
    if (
      typeof owner !== "string" ||
      typeof eventId !== "string" ||
      owner.length > 128 ||
      eventId.length > 200
    )
      return new Response(null, { status: 400 });
    await flushReply(owner, eventId);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
