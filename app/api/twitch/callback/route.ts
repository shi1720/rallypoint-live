import { owner } from "../../../../lib/server/auth";
import { runtime, siteOrigin } from "../../../../lib/server/env";
import { constantEqual, cookie, sha256 } from "../../../../lib/server/security";
import {
  saveAuthorization,
  subscriptions,
} from "../../../../lib/server/twitch";
import { getRoom, mutateRoom } from "../../../../lib/server/rooms";
export async function GET(request: Request) {
  const origin = siteOrigin(request);
  let outcome = "error";
  try {
    const user = await owner();
    const url = new URL(request.url);
    const state = url.searchParams.get("state") ?? "",
      browserState = cookie(request, "rally_oauth") ?? "";
    if (!state || !constantEqual(state, browserState))
      throw new Error("Invalid OAuth state.");
    const hash = await sha256(state);
    const claimed = await runtime()
      .DB.prepare(
        "DELETE FROM oauth_states WHERE hash=? AND owner_id=? AND expires_at>? RETURNING owner_id",
      )
      .bind(hash, user.userId, Date.now())
      .first();
    if (!claimed || url.searchParams.has("error"))
      throw new Error("Authorization was not completed.");
    const code = url.searchParams.get("code");
    if (!code) throw new Error("No authorization code.");
    const channel = await saveAuthorization(user.userId, code, origin);
    const room = await getRoom(user.userId, user.fullName ?? "Your community");
    await mutateRoom(user.userId, {
      type: "settings",
      channel,
      sessionTitle: room.sessionTitle,
    });
    try {
      await subscriptions(user.userId, origin);
      outcome = "connected";
    } catch {
      outcome = "pending";
      await runtime()
        .DB.prepare(
          "UPDATE integrations SET status='error',error='Event subscriptions could not be established. Verify the public callback URL and retry.' WHERE owner_id=?",
        )
        .bind(user.userId)
        .run();
    }
  } catch {
    /* Do not put OAuth codes or provider errors into URLs or logs. */
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/studio?twitch=${outcome}`,
      "Cache-Control": "no-store",
      "Set-Cookie": `rally_oauth=; Path=/api/twitch; HttpOnly; SameSite=Lax; Max-Age=0${origin.startsWith("https:") ? "; Secure" : ""}`,
    },
  });
}
