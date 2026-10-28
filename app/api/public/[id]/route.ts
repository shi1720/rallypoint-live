import { publicState } from "../../../../lib/rally/engine";
import { findPublic, mutateRoom } from "../../../../lib/server/rooms";
import { runtime } from "../../../../lib/server/env";
import {
  apiError,
  cookie,
  HttpError,
  json,
  randomToken,
  sameOrigin,
} from "../../../../lib/server/security";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const state = await findPublic(id);
    if (!state)
      throw new HttpError(404, "This participation page was not found.");
    return json({ state: publicState(state) });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const { id } = await params;
    const state = await findPublic(id);
    if (!state)
      throw new HttpError(404, "This participation page was not found.");
    const cookieName = "rally_open_" + id;
    const seen = cookie(request, cookieName);
    if (seen) return json({ counted: false });
    const row = await runtime()
      .DB.prepare("SELECT owner_id FROM rooms WHERE public_id=?")
      .bind(id)
      .first<{ owner_id: string }>();
    if (!row) throw new HttpError(404, "Page not found.");
    await mutateRoom(row.owner_id, { type: "open" });
    return new Response(JSON.stringify({ counted: true }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Set-Cookie": `${cookieName}=${randomToken(8)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
