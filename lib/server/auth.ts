import { cookies } from "next/headers";
import { firebaseAuth } from "./firebase";
import { HttpError } from "./security";
export const SESSION_COOKIE = "__session";
export async function owner() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) throw new HttpError(401, "Sign in to open your studio.");
  try {
    const user = await firebaseAuth().verifySessionCookie(token, true);
    return {
      userId: user.uid,
      email: user.email ?? "",
      displayName:
        user.name ?? (user.email ? user.email.split("@")[0] : "Guest creator"),
      fullName: user.name ?? null,
      isAnonymous: user.firebase?.sign_in_provider === "anonymous",
    };
  } catch {
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }
}
