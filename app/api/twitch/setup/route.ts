import { owner } from "../../../../lib/server/auth";
import { configured, siteOrigin } from "../../../../lib/server/env";
import { apiError, json } from "../../../../lib/server/security";
export async function GET(request: Request) {
  try {
    await owner();
    return json({
      callbackUrl: `${siteOrigin(request)}/api/twitch/callback`,
      configured: configured(),
      requirements: [
        "Register a confidential application at dev.twitch.tv/console/apps.",
        "Add the callback URL above as an OAuth redirect.",
        "Set TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_WEBHOOK_SECRET, TOKEN_ENCRYPTION_KEY and SITE_URL as server secrets.",
        "The production site must be publicly reachable for Twitch webhooks, public viewer links and OBS. Studio writes still require sign-in.",
        "Connect the Twitch broadcaster account. Rallypoint replies as that account.",
      ],
    });
  } catch (e) {
    return apiError(e);
  }
}
