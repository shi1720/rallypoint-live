import type { RallyState, RoomResponse } from "../rally/types";
import { connectionFor } from "./twitch";
import { siteOrigin } from "./env";
export async function roomResponse(
  state: RallyState,
  user: { userId: string; displayName: string },
  request: Request,
): Promise<RoomResponse> {
  const origin = siteOrigin(request);
  return {
    state,
    connection: await connectionFor(user.userId, request),
    user: { name: user.displayName },
    publicUrl: `${origin}/watch/${state.publicId}`,
    overlayUrl: `${origin}/overlay/${state.publicId}`,
  };
}
