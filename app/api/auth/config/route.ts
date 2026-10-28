import { webConfig } from "../../../../lib/server/firebase";
import { apiError, json } from "../../../../lib/server/security";
export async function GET() {
  try {
    return json(webConfig());
  } catch (e) {
    return apiError(e);
  }
}
