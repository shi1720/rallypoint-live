import { owner } from "../../../../lib/server/auth";
import { subscriptions, connectionFor } from "../../../../lib/server/twitch";
import { siteOrigin } from "../../../../lib/server/env";
import { apiError, json, sameOrigin } from "../../../../lib/server/security";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await owner();
    await subscriptions(user.userId, siteOrigin(request));
    return json(await connectionFor(user.userId, request, true));
  } catch (e) {
    return apiError(e);
  }
}
