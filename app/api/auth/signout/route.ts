import { apiError, sameOrigin } from "../../../../lib/server/security";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    return new Response(JSON.stringify({ signedOut: true }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Set-Cookie": `__session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
