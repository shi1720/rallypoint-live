import { findPublic, recordOpen } from "../../../../lib/server/rooms";
import {
  apiError,
  HttpError,
  json,
  readJson,
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
    return json({ state });
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
    const payload = await readJson(request, 1000);
    if (
      typeof payload.visitorKey !== "string" ||
      !/^[A-Za-z0-9_-]{12,100}$/.test(payload.visitorKey)
    )
      throw new HttpError(400, "A browser visitor key is required.");
    return json({ counted: await recordOpen(id, payload.visitorKey) });
  } catch (e) {
    return apiError(e);
  }
}
