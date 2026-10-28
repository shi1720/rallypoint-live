import { owner } from "../../../lib/server/auth";
import { getRoom, mutateRoom } from "../../../lib/server/rooms";
import {
  apiError,
  HttpError,
  json,
  readJson,
  sameOrigin,
} from "../../../lib/server/security";
import { roomResponse } from "../../../lib/server/response";
import { integration } from "../../../lib/server/twitch";
export async function GET(request: Request) {
  try {
    const user = await owner();
    return json(
      await roomResponse(
        await getRoom(user.userId, user.fullName ?? "Your community"),
        user,
        request,
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await owner();
    await getRoom(user.userId, user.fullName ?? "Your community");
    const action = await readJson(request);
    if (
      !["publish", "close", "review", "settings", "reset"].includes(
        action?.type,
      )
    )
      throw new HttpError(
        403,
        "Chat contributions and raids must arrive through Twitch. Use rehearsal to simulate them.",
      );
    if (action.type === "publish" && !Number.isInteger(action.expectedVersion))
      throw new HttpError(400, "Refresh the studio before publishing.");
    if (action.type === "settings") {
      const connected = await integration(user.userId);
      if (connected && action.channel !== connected.channel)
        throw new HttpError(
          400,
          "The channel name must match your connected Twitch account.",
        );
    }
    const result = await mutateRoom(user.userId, action);
    return json({
      ...(await roomResponse(result.state, user, request)),
      reply: result.reply,
    });
  } catch (e) {
    return apiError(e);
  }
}
