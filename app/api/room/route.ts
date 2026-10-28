import type { Action } from "../../../lib/rally/types";
import { owner } from "../../../lib/server/auth";
import { getRoom, mutateRoom } from "../../../lib/server/rooms";
import {
  apiError,
  HttpError,
  isRecord,
  json,
  readJson,
  sameOrigin,
} from "../../../lib/server/security";
import { roomResponse } from "../../../lib/server/response";
import { integration } from "../../../lib/server/twitch";
type OwnerAction = Exclude<Action, { type: "chat" | "raid" | "open" }>;
function isOwnerAction(
  value: Record<string, unknown>,
): value is Record<string, unknown> & OwnerAction {
  switch (value.type) {
    case "publish": {
      const brief = value.brief;
      return (
        typeof value.expectedVersion === "number" &&
        isRecord(brief) &&
        [
          brief.title,
          brief.context,
          brief.stakes,
          brief.action,
          brief.expiresAt,
        ].every((field) => typeof field === "string") &&
        Array.isArray(brief.choices) &&
        brief.choices.every(
          (choice: unknown) =>
            isRecord(choice) &&
            typeof choice.id === "string" &&
            typeof choice.label === "string",
        )
      );
    }
    case "close":
      return typeof value.expectedVersion === "number";
    case "reset":
      return typeof value.expectedRevision === "number";
    case "review":
      return (
        typeof value.proposalId === "string" &&
        (value.decision === "accepted" || value.decision === "rejected")
      );
    case "settings":
      return (
        typeof value.channel === "string" &&
        typeof value.sessionTitle === "string"
      );
    default:
      return false;
  }
}
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
      typeof action.type !== "string" ||
      !["publish", "close", "review", "settings", "reset"].includes(action.type)
    )
      throw new HttpError(
        403,
        "Chat contributions and raids must arrive through Twitch. Use rehearsal to simulate them.",
      );
    if (action.type === "publish" && !Number.isInteger(action.expectedVersion))
      throw new HttpError(400, "Refresh the studio before publishing.");
    if (action.type === "close" && !Number.isInteger(action.expectedVersion))
      throw new HttpError(400, "Refresh the studio before closing a chapter.");
    if (action.type === "reset" && !Number.isInteger(action.expectedRevision))
      throw new HttpError(
        400,
        "Refresh the studio before starting a new session.",
      );
    if (action.type === "settings") {
      const connected = await integration(user.userId);
      if (connected && action.channel !== connected.channel)
        throw new HttpError(
          400,
          "The channel name must match your connected Twitch account.",
        );
    }
    if (!isOwnerAction(action))
      throw new HttpError(400, "A valid studio action is required.");
    const result = await mutateRoom(user.userId, action);
    return json({
      ...(await roomResponse(result.state, user, request)),
      reply: result.reply,
    });
  } catch (e) {
    return apiError(e);
  }
}
