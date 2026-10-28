"use client";

import type { Auth, User } from "firebase/auth";

let client: Promise<Auth> | undefined;

/** Firebase credentials are public app configuration. Authentication tokens stay in the SDK/session cookie. */
export async function getFirebaseClient(): Promise<Auth> {
  if (!client) {
    client = (async () => {
      const response = await fetch("/api/auth/config", {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      const config = (await response.json()) as {
        apiKey: string;
        authDomain: string;
        projectId: string;
        appId: string;
        messagingSenderId?: string;
        error?: string;
      };
      if (!response.ok || !config.apiKey || !config.projectId) {
        throw new Error(
          config.error ||
            "Sign-in is temporarily unavailable. Please try again.",
        );
      }
      const [
        { getApps, initializeApp },
        { getAuth, setPersistence, browserLocalPersistence },
      ] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
      const app =
        getApps().find((item) => item.name === "rallypoint") ||
        initializeApp(config, "rallypoint");
      const auth = getAuth(app);
      await setPersistence(auth, browserLocalPersistence);
      await auth.authStateReady();
      return auth;
    })().catch((error) => {
      client = undefined;
      throw error;
    });
  }
  return client;
}

export function authErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  )
    return "The connection took too long. Please try again.";
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const messages: Record<string, string> = {
    "auth/invalid-credential":
      "The email or password is not correct. Please try again.",
    "auth/user-not-found":
      "The email or password is not correct. Please try again.",
    "auth/wrong-password":
      "The email or password is not correct. Please try again.",
    "auth/email-already-in-use":
      "An account already uses that email. Choose Sign in or reset your password.",
    "auth/credential-already-in-use":
      "An account already uses that email. Sign in to open its workspace.",
    "auth/weak-password": "Choose a password with at least eight characters.",
    "auth/password-does-not-meet-requirements":
      "Choose a password with at least eight characters, including a letter and a number.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/too-many-requests":
      "Too many attempts. Please wait a moment before trying again.",
    "auth/network-request-failed":
      "The connection was interrupted. Check your network and try again.",
    "auth/operation-not-allowed":
      "This sign-in method is temporarily unavailable. Please try another option.",
    "auth/user-disabled":
      "This account cannot sign in. Contact the workspace owner for help.",
    "auth/web-storage-unsupported":
      "Your browser is blocking secure sign-in storage. Allow site storage or try another browser window.",
    "auth/requires-recent-login":
      "Sign in again before changing your account details.",
  };
  return (
    messages[code] ||
    (error instanceof Error && !code
      ? error.message
      : "Sign-in could not be completed. Please try again.")
  );
}

async function establishSession(user: User) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: await user.getIdToken(true) }),
    signal: AbortSignal.timeout(15000),
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok)
    throw new Error(
      result.error || "Your session could not be started. Please try again.",
    );
}

export async function signInGuest() {
  const auth = await getFirebaseClient();
  const { signInAnonymously } = await import("firebase/auth");
  // Reuse the browser's anonymous account so returning guests keep their workspace.
  const user = auth.currentUser || (await signInAnonymously(auth)).user;
  await establishSession(user);
}

export async function signInEmail(email: string, password: string) {
  const auth = await getFirebaseClient();
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  await establishSession(
    (await signInWithEmailAndPassword(auth, email.trim(), password)).user,
  );
}

export async function signUpEmail(email: string, password: string) {
  const auth = await getFirebaseClient();
  const {
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    linkWithCredential,
  } = await import("firebase/auth");
  const user = auth.currentUser?.isAnonymous
    ? (
        await linkWithCredential(
          auth.currentUser,
          EmailAuthProvider.credential(email.trim(), password),
        )
      ).user
    : (await createUserWithEmailAndPassword(auth, email.trim(), password)).user;
  await establishSession(user);
}

export async function resetPassword(email: string) {
  const auth = await getFirebaseClient();
  const { sendPasswordResetEmail } = await import("firebase/auth");
  await sendPasswordResetEmail(auth, email.trim(), {
    url: `${location.origin}/signin`,
  });
}

export async function signOutUser() {
  const response = await fetch("/api/auth/signout", {
    method: "POST",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Error("Sign-out could not be completed. Please try again.");
  // Erasing the server session is essential even if the browser SDK is unavailable.
  try {
    const auth = await getFirebaseClient();
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  } catch {
    /* The HTTP-only server session has already been cleared. */
  }
}

export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return "/studio";
  try {
    const parsed = new URL(value, "https://rallypoint.local");
    const pathname =
      decodeURIComponent(parsed.pathname).replace(/\/+$/, "") || "/";
    if (
      parsed.origin !== "https://rallypoint.local" ||
      pathname === "/signin" ||
      pathname === "/api" ||
      pathname.startsWith("/api/")
    )
      return "/studio";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/studio";
  }
}
