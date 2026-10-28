import { owner } from "../../../lib/server/auth";
import { getRoom } from "../../../lib/server/rooms";
import { apiError } from "../../../lib/server/security";
export async function GET() {
  try {
    const user = await owner();
    const state = await getRoom(user.userId);
    return new Response(
      JSON.stringify(
        {
          format: "rallypoint-export-v1",
          exportedAt: new Date().toISOString(),
          state,
        },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition":
            'attachment; filename="rallypoint-session.json"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
