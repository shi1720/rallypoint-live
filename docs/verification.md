# Release verification

Verified October 28, 2026. Application: https://rallypoint-desk.web.app

[Hosted check record](deployed-checks.json)

## Observed results

- 112 local automated tests pass.
- Full ESLint and TypeScript checks pass.
- Native Next production build passes.
- Production dependency audit reports zero vulnerabilities.
- GitHub CI passed for source `06e50056ac2ff8b384348e4bc024d3e08999ed0c`: https://github.com/shi1720/rallypoint-live/actions/runs/40695556107
- The exact-source Cloud Run release `rallypoint-00008-mwh` reports that source revision through `/api/health`.
- 41 hosted HTTP checks passed at 2026-10-28T14:57:44Z. The suite uses actual Firebase identities, server sessions, Firestore transactions, and Cloud Tasks invoking the worker. Twitch-shaped fixtures are cryptographically signed test events, not live Twitch evidence.

The signed callback check verifies the raw challenge body, status, media type and required Content-Length through the actual Firebase HTTPS endpoint. Permission-denial regressions cover immediate atomic public pausing, token rotation, reconnect races, rollback and owner isolation.

The hosted suite verifies guest authentication, guest-to-email linking without changing owner identity, email/password login, secure cookies, malformed input rejection, owner isolation, stale publish/close/reset protection, public data minimization, browser-open deduplication, webhook signatures and replay, durable outbox delivery, worker authentication, export, closure propagation and guarded session reset. It removes only the test accounts and records it creates.

## Browser checks

The public Firebase deployment was tested in Chrome at normal desktop size and a 390 by 844 device-emulation viewport. Home, workspace, account upgrade and public viewer pages showed no horizontal overflow. The viewer uses the community fallback when a channel is not connected. A real browser guest workspace was created, a starter was edited and published, and the saved brief survived reload. Empty publication was rejected. The browser downloaded a valid authenticated JSON export containing no integration credentials. Callback copying produced the exact canonical URL. New-session controls require an explicit export acknowledgment. Guest sign-out warns about access loss and offers an account upgrade; staying in the workspace preserves access. The final release also correctly labels the expired mission EXPIRED and disables its old action.

The rehearsal demonstrated voting and vote replacement, untrusted pitch dismissal, acceptance followed by separate editing/publication, a labeled simulated raid, chapter closure, and viewer/overlay updates. The overlay HTML, body and root all have transparent computed backgrounds. This is a browser-source preview, not an assertion that OBS or a Twitch stream was recorded.

## Genuine Twitch checkpoint

[Manual live-channel evidence record](live-twitch-verification.json). On October 28, 2026, the authorized shi1720 account completed OAuth, and Twitch confirmed both chat and incoming raid subscriptions enabled. Real `!catchup` returned the matching published brief in a threaded Twitch reply; its durable outbox record was `sent`. Real `!join A` recorded one contributor, and `!join B` replaced the choice without increasing that count. The desk and public viewer agreed.

A clearly labeled, self-authored `!pitch` entered private review and stayed off the public API and brief. Accepting it did not publish. A separate edit and explicit publish produced version 3 with fresh current counts. Closing that chapter removed the old invitation from the viewer page. A subsequent real `!join A` returned the no-active-brief response in Twitch, with a sent outbox record and no new contribution. These observations are separate from the signed-fixture suite.

## Published materials

The 2 minute 45 second [product walkthrough](https://www.youtube.com/watch?v=W0e7IDiO93g) is public on Shivam Gupta's YouTube channel. Genuine Twitch proof appears at 00:36 to 01:03. Its chat portion uses actual timestamped screenshots with idle time omitted; other sample chat and raid scenes remain visibly simulated. The 1920 by 1080 video has natural neural narration, 47 burned caption cues and a separately published manual English subtitle track. Public playback and the English track were verified in the YouTube player. Its title, description, custom thumbnail, AI disclosure and successful initial copyright/Community Guidelines checks were verified. The superseded V1 is saved as unlisted, with its source file unchanged.

Devpost displays SUBMITTED, 5/5 steps done, completed personal attestations and the disabled Project submitted control. This status was observed after the user-facing handoff; the agent did not perform the final prize-entry action. The story and technology explanation include genuine Twitch results. The updated public V2 URL was saved and re-read from the submission form. The app and source links, three captioned screenshots, thumbnail, tagline, creator credit, main build session ID and user-provided survey answers remain saved.

## Proof boundaries

The Twitch developer application and credentials are configured through Secret Manager, and the genuine channel checks above passed. They used one consenting broadcaster account outside a live broadcast. No genuine incoming raid or native OBS capture is claimed. OBS is optional for web and chat use. Public pages fail closed when fresh state or chat readiness is missing. The connected browser still owns a guest workspace; preserve its identity and upgrade through Create an account before clearing browser data or signing out.

No customer adoption, retention lift, revenue or paid checkout is claimed. Polling and storage still incur operational usage despite zero model inference calls. See the independent review and operating assumptions before a paid launch.

## Reproduce

Use Node.js 24.12 or newer. Run `npm ci`, `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`, and `npm audit --omit=dev --audit-level=moderate`. The cloud-maintainer suite is `npm run test:http`; it needs gcloud access to this deployment for its scoped fixture setup and cleanup. Judges can test the public rehearsal and guest workspace without cloud-admin credentials. See testing-instructions.md.
