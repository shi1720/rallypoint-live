# Release verification

Verified October 28, 2026. Application: https://rallypoint-desk.web.app

## Observed results

- 99 local automated tests pass.
- Full ESLint and TypeScript checks pass.
- Native Next production build passes.
- Production dependency audit reports zero vulnerabilities.
- GitHub CI passed for source `91101ea8036dd0e419a8475b26a8bbd2c1e71d61`: https://github.com/shi1720/rallypoint-live/actions/runs/40685255053
- The exact-source Cloud Run release `rallypoint-00006-kkj` reports that source revision through `/api/health`.
- 40 hosted HTTP checks passed at 2026-10-28T12:44:08Z. The suite uses actual Firebase identities, server sessions, Firestore transactions, and Cloud Tasks invoking the worker. Twitch-shaped fixtures are cryptographically signed test events, not live Twitch evidence.

The hosted suite verifies guest authentication, guest-to-email linking without changing owner identity, email/password login, secure cookies, malformed input rejection, owner isolation, stale publish/close/reset protection, public data minimization, browser-open deduplication, webhook signatures and replay, durable outbox delivery, worker authentication, export, closure propagation and guarded session reset. It removes only the test accounts and records it creates.

## Browser checks

The public Firebase deployment was tested in Chrome at normal desktop size and a 390 by 844 device-emulation viewport. Home, workspace and account upgrade pages showed no horizontal overflow. A real browser guest workspace was created, a starter was edited and published, and the saved brief survived reload. Empty publication was rejected. The browser downloaded a valid authenticated JSON export containing no integration credentials. Callback copying produced the exact canonical URL. New-session controls require an explicit export acknowledgment. Guest sign-out warns about access loss and offers an account upgrade; staying in the workspace preserves access. The final release also correctly labels the expired mission EXPIRED and disables its old action.

The rehearsal demonstrated voting and vote replacement, untrusted pitch dismissal, acceptance followed by separate editing/publication, a labeled simulated raid, chapter closure, and viewer/overlay updates. The overlay HTML, body and root all have transparent computed backgrounds. This is a browser-source preview, not an assertion that OBS or a Twitch stream was recorded.

## Published materials

The 2 minute 18 second [product walkthrough](https://www.youtube.com/watch?v=CbFh_5jZIUE) is public on Shivam Gupta's YouTube channel. Its title, description, custom thumbnail, playback, and English transcript were verified in the browser. The walkthrough uses genuine application captures with continuously labeled simulated chat and raid events. It has narration, burned captions, and an uploaded English subtitle track. YouTube reported no issues in its initial copyright and Community Guidelines checks.

The Devpost draft contains the saved story, testing appendix, app and source links, video, three captioned screenshots, thumbnail, tagline, creator credit, main build session ID, and user-provided survey answers. Personal eligibility attestations and final entry submission remain with Shivam.

## Proof boundaries

Actual broadcaster OAuth, enabled real EventSub subscriptions, real chat responses and an actual OBS capture remain unverified because Twitch account sign-in and developer credentials are pending. The application displays that configuration state. Public pages fail closed when fresh state or chat readiness is missing.

No customer adoption, retention lift, revenue or paid checkout is claimed. Polling and storage still incur operational usage despite zero model inference calls. See the independent review and operating assumptions before a paid launch.

## Reproduce

Use Node.js 24.12 or newer. Run `npm ci`, `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`, and `npm audit --omit=dev --audit-level=moderate`. The cloud-maintainer suite is `npm run test:http`; it needs gcloud access to this deployment for its scoped fixture setup and cleanup. Judges can test the public rehearsal and guest workspace without cloud-admin credentials. See testing-instructions.md.
