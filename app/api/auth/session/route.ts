import { firebaseAuth } from "../../../../lib/server/firebase";
import {
  apiError,
  HttpError,
  readJson,
  sameOrigin,
} from "../../../../lib/server/security";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await readJson(request, 18000);
    if (typeof body.idToken !== "string" || body.idToken.length > 16000)
      throw new HttpError(400, "A valid sign-in token is required.");
    let token;
    try {
      token = await firebaseAuth().verifyIdToken(body.idToken, true);
    } catch {
      throw new HttpError(401, "Sign-in was not confirmed. Please try again.");
    }
    if (!token.iat || Math.abs(Date.now() / 1000 - token.iat) > 300)
      throw new HttpError(
        401,
        "Please sign in again to create a fresh session.",
      );
    const expiresIn = 5 * 24 * 60 * 60 * 1000;
    const session = await firebaseAuth().createSessionCookie(body.idToken, {
      expiresIn,
    });
    return new Response(JSON.stringify({ signedIn: true }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Set-Cookie": `__session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expiresIn / 1000}${process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
