# Verification record

The Firebase release replaces the earlier Sites/Cloudflare runtime. Test results from that earlier deployment do not establish behavior of the migrated application.

## Verification layers

| Layer                  | Scope                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain tests           | Versioned publication, stale close/reset rejection, expiry, moderation boundaries, cooldowns, event-time ordering, replay handling, privacy, aggregate counts, and bounded state. |
| Authentication helpers | Safe same-origin return paths and useful authentication errors without exposing provider diagnostics.                                                                             |
| Storage tests          | Compressed private state, bounded decoding, Firestore document-size handling, and separate public snapshots.                                                                      |
| Webhook/security tests | HMAC/AES-GCM, payload limits, signed routing, duplicate deliveries, error handling, and provider boundaries.                                                                      |
| Deployed suite         | Actual Firebase identities and session cookies, owner isolation, Firestore transactions, public projections, signed fixture ingress, and session controls.                        |
| Browser review         | Sign-in, guest/account behavior, real workspace controls, mobile layout, viewer freshness, and overlay preview. Record the exact observed deployment before claiming completion.  |
| Real Twitch and OBS    | Requires broadcaster authorization, enabled subscriptions, actual chat commands/replies, and an actual OBS Browser Source. These remain separate release gates.                   |

Run the current automated checks with Node.js 24.12 or newer:

```sh
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

The designated operator suite is `tests/deployed-e2e.mjs`. Its signed fixtures traverse the deployed HTTP handler and Firestore transaction, but they are not live Twitch traffic. It creates isolated disposable users and records and removes its own fixtures. It requires operator access to the backing project and signing secret; normal application testers should use the public sample and sign-in flows instead.

## Current limits on claims

No Twitch client credentials or completed broadcaster authorization are included in the repository. Until the real flow is observed, do not claim that the Firebase release has received actual Twitch chat, sent a real reply, or rendered in an actual OBS capture.

Do not equate a command during a raid welcome with verified raid membership or retention. Do not claim customers, paid checkout, large-channel capacity, an uptime commitment, or an independent security certification.

The current release run should record the deployed code revision, clean Firebase URL, observed test counts, CI result, browser sizes reviewed, and any unresolved external account step. The build agent updates this record from actual tool results rather than inheriting an earlier platform's test totals.

## Earlier checkpoint

The initial implementation recorded 59 engine/security tests and 15 local D1 HTTP checks, plus a dependency audit and browser review. That is historical evidence for the former platform only. It is not the Firebase release acceptance result.
