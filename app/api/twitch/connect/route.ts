import { cookies } from "next/headers";
import { owner, SESSION_COOKIE } from "../../../../lib/server/auth";
import { configured, runtime, siteOrigin } from "../../../../lib/server/env";
import {
  apiError,
  HttpError,
  randomToken,
  sha256,
} from "../../../../lib/server/security";
import { store, expiry } from "../../../../lib/server/store";
import { SCOPES } from "../../../../lib/server/twitch";
export async function GET(request: Request) {
  try {
    const user = await owner();
    if (!configured())
      throw new HttpError(
        503,
        "Twitch setup is incomplete. The server needs its application credentials.",
      );
    if (request.headers.get("sec-fetch-site") === "cross-site")
      throw new HttpError(403, "Start this connection from your studio.");
    const state = randomToken(),
      session = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!session)
      throw new HttpError(401, "Sign in again before connecting Twitch.");
    await store()
      .collection("oauthStates")
      .doc(await sha256(state))
      .create({
        owner_id: user.userId,
        session_hash: await sha256(session),
        expiresAt: expiry(1 / 6),
      });
    const url = new URL("https://id.twitch.tv/oauth2/authorize");
    url.search = new URLSearchParams({
      client_id: runtime().TWITCH_CLIENT_ID!,
      redirect_uri: `${siteOrigin(request)}/api/twitch/callback`,
      response_type: "code",
      scope: SCOPES.join(" "),
      state,
      force_verify: "true",
    }).toString();
    return new Response(null, {
      status: 302,
      headers: { Location: url.toString(), "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
