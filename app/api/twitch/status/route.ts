import { owner } from "../../../../lib/server/auth";
import { connectionFor } from "../../../../lib/server/twitch";
import { apiError, json } from "../../../../lib/server/security";
export async function GET(request: Request) {
  try {
    const user = await owner();
    return json(await connectionFor(user.userId, request, true));
  } catch (e) {
    return apiError(e);
  }
}
