import { handleWebhook } from "../../../../lib/server/webhook";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleWebhook(request);
}
