import test from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage, safeReturnPath } from "../lib/firebase-client.ts";

test("sign-in return paths cannot redirect to another origin or an action endpoint", () => {
  for (const value of [
    null,
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "javascript:alert(1)",
    "/api",
    "/api/twitch/connect",
    "/%61pi/auth/session",
    "/signin",
    "/signin/",
    "/signin?return_to=/signin",
    "/%ZZ",
  ]) {
    assert.equal(safeReturnPath(value), "/studio", String(value));
  }
});

test("safe same-origin return paths preserve useful page state", () => {
  assert.equal(safeReturnPath("/studio"), "/studio");
  assert.equal(
    safeReturnPath("/studio?tab=setup#connection"),
    "/studio?tab=setup#connection",
  );
  assert.equal(
    safeReturnPath("/watch/123?hello=world"),
    "/watch/123?hello=world",
  );
});

test("authentication errors give actionable wording without exposing provider diagnostics", () => {
  for (const code of [
    "auth/wrong-password",
    "auth/user-not-found",
    "auth/invalid-credential",
  ]) {
    assert.equal(
      authErrorMessage({ code }),
      "The email or password is not correct. Please try again.",
    );
  }
  assert.match(
    authErrorMessage({ code: "auth/email-already-in-use" }),
    /reset your password/,
  );
  assert.match(
    authErrorMessage({
      code: "auth/unknown",
      message: "SENSITIVE_PROVIDER_DETAIL",
    }),
    /could not be completed/,
  );
  assert.equal(
    authErrorMessage(
      new DOMException("INTERNAL_TIMEOUT_DETAIL", "TimeoutError"),
    ),
    "The connection took too long. Please try again.",
  );
});
