import { owner } from "../../../../lib/server/auth";
import { disconnect } from "../../../../lib/server/twitch";
import { apiError, json, sameOrigin } from "../../../../lib/server/security";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await owner();
    const incomplete = await disconnect(user.userId);
    return json({
      disconnected: true,
      warning: incomplete
        ? "Local tokens erased. Twitch cleanup was not confirmed; revoke access from Twitch Connections if needed."
        : undefined,
    });
  } catch (e) {
    return apiError(e);
  }
}
