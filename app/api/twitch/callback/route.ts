import { cookies } from "next/headers";
import { owner, SESSION_COOKIE } from "../../../../lib/server/auth";
import { siteOrigin } from "../../../../lib/server/env";
import { sha256 } from "../../../../lib/server/security";
import { store, updateIntegrationError } from "../../../../lib/server/store";
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
    const url = new URL(request.url),
      state = url.searchParams.get("state"),
      session = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!state || !session || state.length > 100)
      throw new Error("Invalid OAuth state.");
    const hash = await sha256(state),
      sessionHash = await sha256(session),
      ref = store().collection("oauthStates").doc(hash);
    const claimed = await store().runTransaction(async (tx) => {
      const row = await tx.get(ref);
      if (
        !row.exists ||
        row.get("owner_id") !== user.userId ||
        row.get("session_hash") !== sessionHash ||
        row.get("expiresAt").toMillis() < Date.now()
      )
        return false;
      tx.delete(ref);
      return true;
    });
    if (!claimed || url.searchParams.has("error"))
      throw new Error("Authorization was not completed.");
    const code = url.searchParams.get("code");
    if (!code) throw new Error("No authorization code.");
    const channel = await saveAuthorization(user.userId, code, origin);
    const room = await getRoom(user.userId, user.displayName);
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
      await updateIntegrationError(
        user.userId,
        "Event setup was not confirmed. Verify the public callback and retry.",
      );
    }
  } catch {
    /* Never expose authorization codes or provider payloads. */
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/studio?twitch=${outcome}`,
      "Cache-Control": "no-store",
    },
  });
}
