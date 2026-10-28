import { runtime } from "../../../lib/server/env";
export async function GET() {
  try {
    await runtime().DB.prepare("SELECT 1 AS ok").first();
    return Response.json(
      { status: "ok", service: "rallypoint", version: "1.0.0" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
