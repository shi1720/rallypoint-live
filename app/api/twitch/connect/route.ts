import { owner } from "../../../../lib/server/auth";
import { configured, runtime, siteOrigin } from "../../../../lib/server/env";
import {
  apiError,
  HttpError,
  randomToken,
  sha256,
} from "../../../../lib/server/security";
import { SCOPES } from "../../../../lib/server/twitch";
export async function GET(request: Request) {
  try {
    const user = await owner();
    if (!configured())
      throw new HttpError(
        503,
        "Twitch setup is incomplete. See Setup for required credentials.",
      );
    if (request.headers.get("sec-fetch-site") === "cross-site")
      throw new HttpError(403, "Start this connection from your studio.");
    const state = randomToken();
    await runtime().DB.batch([
      runtime()
        .DB.prepare("DELETE FROM oauth_states WHERE expires_at<? OR owner_id=?")
        .bind(Date.now(), user.userId),
      runtime()
        .DB.prepare(
          "INSERT INTO oauth_states(hash,owner_id,expires_at) VALUES(?,?,?)",
        )
        .bind(await sha256(state), user.userId, Date.now() + 600000),
    ]);
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
      headers: {
        Location: url.toString(),
        "Cache-Control": "no-store",
        "Set-Cookie": `rally_oauth=${state}; Path=/api/twitch; HttpOnly; SameSite=Lax; Max-Age=600${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
