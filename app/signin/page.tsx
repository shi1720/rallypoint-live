"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Brand } from "@/components/rally/shared";
import {
  authErrorMessage,
  getFirebaseClient,
  resetPassword,
  safeReturnPath,
  signInEmail,
  signInGuest,
  signUpEmail,
} from "@/lib/firebase-client";

type Mode = "signin" | "signup" | "reset";
export default function SignInPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"email" | "guest" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [guest, setGuest] = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [returnTo, setReturnTo] = useState("/studio");
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    // Browser-only query state is intentionally applied after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReturnTo(safeReturnPath(params.get("return_to")));
    if (params.get("mode") === "signup") setMode("signup");
    getFirebaseClient()
      .then((auth) => {
        setGuest(!!auth.currentUser?.isAnonymous);
        setHasSavedSession(!!auth.currentUser);
      })
      .catch(() => {});
  }, []);
  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setMessage("");
  };
  return (
    <main className="signin-root">
      <nav className="signin-nav">
        <Brand />
        <Link className="text-link" href="/">
          <ArrowLeft size={14} /> Back to Rallypoint
        </Link>
      </nav>
      <div className="signin-layout">
        <section className="signin-story">
          <span className="eyebrow">
            <Users size={15} /> YOUR COMMUNITY STARTS HERE
          </span>
          <h1>
            Set the scene.
            <br />
            <em>Make room for everyone.</em>
          </h1>
          <p>
            One current goal. One clear way to join. Your participation desk
            keeps the stream, chat, and arriving viewers in the same chapter.
          </p>
          <div
            className="signin-brief"
            aria-label="Example participation brief"
          >
            <div>
              <span className="tiny-dot" /> AN INVITATION, READY WHEN THEY
              ARRIVE
            </div>
            <strong>What should we build next?</strong>
            <p>Chat is shaping our next shared project. Everyone gets a say.</p>
            <code>
              !join A <span>A cozy reading nook</span>
            </code>
            <code>
              !join B <span>A rooftop garden</span>
            </code>
          </div>
          <p className="signin-story-note">
            <ShieldCheck size={16} /> You publish the brief. Your community
            helps write the next chapter.
          </p>
        </section>
        <section className="signin-panel" aria-labelledby="signin-heading">
          <div className="signin-panel-top">
            <LockKeyhole size={23} />
            <span className="eyebrow">YOUR CREATOR WORKSPACE</span>
          </div>
          <h2 id="signin-heading">
            {mode === "reset"
              ? "Reset your password"
              : mode === "signup"
                ? guest
                  ? "Keep your workspace"
                  : "Create your account"
                : "Welcome to your desk"}
          </h2>
          <p>
            {mode === "reset"
              ? "Enter your account email. We will send a secure password reset link if an account exists."
              : mode === "signup"
                ? guest
                  ? "Add an email and password to keep this browser's workspace and open it on other devices."
                  : "Your briefs and review queue belong to you. Create an account to keep them across devices."
                : "Sign in to return to your community's current chapter."}
          </p>
          {mode !== "reset" && (
            <div
              className="signin-tabs"
              role="group"
              aria-label="Account action"
            >
              <button
                type="button"
                aria-pressed={mode === "signin"}
                className={mode === "signin" ? "selected" : ""}
                onClick={() => switchMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                aria-pressed={mode === "signup"}
                className={mode === "signup" ? "selected" : ""}
                onClick={() => switchMode("signup")}
              >
                Create account
              </button>
            </div>
          )}
          <form
            className="signin-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy("email");
              setError("");
              setMessage("");
              try {
                if (mode === "reset") {
                  await resetPassword(email);
                  setMessage(
                    "If an account uses that email, a reset link is on its way. Check your inbox and spam folder.",
                  );
                } else {
                  await (mode === "signup"
                    ? signUpEmail(email, password)
                    : signInEmail(email, password));
                  location.assign(returnTo);
                }
              } catch (err) {
                if (
                  mode === "reset" &&
                  typeof err === "object" &&
                  err &&
                  "code" in err &&
                  err.code === "auth/user-not-found"
                )
                  setMessage(
                    "If an account uses that email, a reset link is on its way. Check your inbox and spam folder.",
                  );
                else setError(authErrorMessage(err));
              } finally {
                setBusy(null);
              }
            }}
          >
            <label htmlFor="account-email">Email address</label>
            <input
              id="account-email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
            {mode !== "reset" && (
              <>
                <div className="password-label">
                  <label htmlFor="account-password">Password</label>
                  {mode === "signin" && (
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => switchMode("reset")}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="password-input">
                  <input
                    id="account-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    required
                    minLength={mode === "signup" ? 8 : undefined}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={
                      mode === "signup"
                        ? "At least 8 characters"
                        : "Your password"
                    }
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {mode === "signup" && (
                  <small>
                    Use at least eight characters. A mix of letters and numbers
                    is best.
                  </small>
                )}
              </>
            )}
            {error && (
              <div className="inline-error" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="signin-success" role="status">
                <Check size={16} />
                <span>{message}</span>
              </div>
            )}
            <button className="btn btn-primary" disabled={!!busy} type="submit">
              {busy === "email" ? (
                <LoaderCircle size={17} className="spin" />
              ) : null}
              {mode === "reset"
                ? "Send reset link"
                : mode === "signup"
                  ? guest
                    ? "Save my account"
                    : "Create account"
                  : "Sign in"}
              <ArrowRight size={16} />
            </button>
            {mode === "reset" && (
              <button
                className="text-link signin-back"
                type="button"
                onClick={() => switchMode("signin")}
              >
                <ArrowLeft size={14} /> Back to sign in
              </button>
            )}
          </form>
          {mode !== "reset" && (
            <>
              <div className="signin-divider">
                <span /> or explore with your own workspace <span />
              </div>
              <button
                type="button"
                disabled={!!busy}
                className="btn btn-quiet signin-guest"
                onClick={async () => {
                  setBusy("guest");
                  setError("");
                  try {
                    await signInGuest();
                    location.assign(returnTo);
                  } catch (err) {
                    setError(authErrorMessage(err));
                    setBusy(null);
                  }
                }}
              >
                {busy === "guest" ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Users size={17} />
                )}
                {hasSavedSession ? "Open saved workspace" : "Try a workspace"}{" "}
                <ArrowRight size={16} />
              </button>
              <p className="signin-guest-note">
                Saved to this browser. Create an account to use it across
                devices.
              </p>
            </>
          )}
          <div className="signin-security">
            <ShieldCheck size={15} />
            <span>
              Secure sign-in. Your published brief is public; your workspace
              stays private.
            </span>
          </div>
        </section>
      </div>
      <footer className="signin-footer">
        <span>Rallypoint. Give every viewer a way in.</span>
        <a href="/demo">
          Explore a sample scenario <ArrowRight size={13} />
        </a>
      </footer>
    </main>
  );
}
