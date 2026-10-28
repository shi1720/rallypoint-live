import { store } from "../../../lib/server/store";
export async function GET() {
  try {
    await store().collection("health").doc("connectivity").get();
    return Response.json(
      {
        status: "ok",
        service: "rallypoint",
        version: "2.0.0",
        revision: process.env.RELEASE_REVISION || "development",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
