# Codex build record

Creator: Shivam Gupta. Main build chat: `01a181e2-464a-7302-821d-a300d09b283c` (verified in Codex's browser/session context). Confirm with `/status` before submitting if the app presents a different session identifier.

Built on October 28, 2026. Shivam supplied the brief, asked for autonomous implementation, emphasized real commercial usefulness, free-first operation and polished deliverables, and authorized repository creation. Codex implemented research, design, state logic, frontend, backend, tests and documentation in this chat. Supporting agents researched competitors, wrote and audited the state/security logic, implemented the interface, and reviewed the proposal against the rubric.

## Decisions with evidence

1. Checked the official rules and submission requirements.
2. Researched recap competitors and Twitch's announced Mid-Stream Summaries. Narrowed the product to an approved, expiring participation brief with an exact next action.
3. Kept the runtime deterministic. The hackathon requires building with Codex, not an LLM call for every chat message. This reduces operating cost and avoids generated facts reaching a stream.
4. Shared one pure state engine between simulated rehearsal and authenticated real EventSub ingestion.
5. Added owner authorization, same-origin writes, single-use cookie-bound OAuth state, encrypted tokens, raw-body HMAC checks, durable delivery receipts, stale-editor protection and an outbox.
6. Tested domain behavior, security helpers and the webhook with mocked external boundaries; then exercised the actual local Worker and D1 through HTTP.
7. Used an independent skeptical rubric review to prioritize real Twitch proof and lower first-brief setup burden. Added editable rescue, maker and tabletop templates.
8. Kept all simulated people/events explicitly labeled and live authorization/recording gaps visible.

## Evidence for the video

Show this chat's product decision and test run, then the actual corresponding source files. Keep secrets and private browser content out of the recording. The verification report distinguishes unit/mocked tests, actual local HTTP checks, browser review and real Twitch validation. Use that distinction in the Devpost write-up. A recording of simulated chat must never be presented as a live Twitch test.

## Firebase release migration

The later release request explicitly selected a clean Firebase URL, full product testing, and production-style presentation. The primary application URL is now `https://rallypoint-desk.web.app`. The backing project is `granted-ai-2026`, with an isolated named Firestore database, a dedicated Cloud Run service, Firebase Authentication, and Cloud Tasks.

The migration removed the previous Cloudflare runtime and Sites identity-header helper. Firebase verifies real anonymous or email/password identities and creates HTTP-only app sessions. The frontend adds guest upgrade, sign-out, first-run onboarding, export-first reset, and stale confirmation protection. Public page-open tracking uses a random browser identifier because Firebase Hosting forwards only the designated session cookie to the dynamic backend.

The application continues to use the same deterministic domain engine. Storage now compresses and bounds private session state while keeping a separate public snapshot. The new deployed suite uses real Firebase sessions and Firestore transactions, with isolated signed event fixtures and cleanup. Those fixtures remain explicitly distinct from real Twitch account authorization and real chat delivery.

The requested public story uses the headings in `docs/devpost-submission.md`. The product UI and demo narrative avoid hackathon branding. Shivam's direction and review goals remain credited accurately; no human implementation work, creator interviews, paying users, or live Twitch proof have been invented.

## Firebase release verification

The release replaced the previous platform-specific authentication and D1 storage with native Next.js, Firebase Authentication, named Firestore storage, Cloud Run and Cloud Tasks. Firebase Hosting provides https://rallypoint-desk.web.app. The server verifies Firebase sessions rather than accepting caller-supplied identity headers.

The current local suite passes 99 tests. Hosted checks use actual Firebase guest and email/password identities, owner-isolated Firestore transactions, secure sessions, public snapshots, and Cloud Tasks invoking the worker. Signed Twitch-shaped fixtures exercise the webhook and replay boundaries. These fixtures do not establish real broadcaster OAuth, chat delivery, or Twitch-stream evidence.

Independent review found and fixed stale command invitations, background token revocation, guest sign-out access loss, oversized storage, command truncation and a queue IAM configuration issue. The final deployment is verified separately in docs/verification.md.


## Firebase release verification

The deployed application source is `06e50056ac2ff8b384348e4bc024d3e08999ed0c`. The final checkpoint passed 112 local tests, full lint and TypeScript checks, the production build, GitHub CI and 41 hosted checks. Production dependencies have zero reported audit vulnerabilities. The hosted checks use real Firebase identities, Firestore transactions and Cloud Tasks, with explicitly signed Twitch-shaped fixtures. The callback contract is checked through Firebase HTTPS, including the raw challenge and Content-Length.

The public captioned walkthrough is https://www.youtube.com/watch?v=CbFh_5jZIUE. Devpost contains the saved story, links, screenshots, thumbnail, video and user-provided survey answers. The main Codex session ID was verified from the runtime. Twitch account sign-in is available, but developer-app registration was rejected because account two-factor authentication is disabled. Authentic Twitch authorization, replies and actual OBS capture remain separate release gates.


The account owner completed Twitch 2FA. Rallypoint Desk was registered, its client credentials were validated and placed in Secret Manager, and the backend configuration was released as `rallypoint-00008-mwh`. The 41 hosted checks passed again on that configuration. At that earlier checkpoint, the broadcaster chat grant and actual test-message permission were pending; no real Twitch response or OBS capture was claimed. Temporary local credentials were removed.

## Genuine Twitch channel checkpoint

After the user approved chat/bot access and named test commands, shi1720 completed OAuth. Both real chat and incoming raid subscriptions were enabled. A real `!catchup` received the matching threaded brief with a sent outbox record. `!join A` followed by `!join B` changed one vote without adding a voter. A labeled self-authored pitch stayed in private review; acceptance did not publish, and a separate edited publication created version3. Closing the chapter removed the public invitation, and a subsequent real command received the no-active-brief reply without changing counts. Devpost subsequently displayed Submitted,5/5 steps done, with completed personal attestations and a disabled final control. The agent observed that status and did not perform the final prize-entry action. Story and technology fields were updated through the normal edit workflow. These observations are recorded separately in `live-twitch-verification.json`; they do not establish a genuine raid, native OBS behavior, independent adoption, or paid demand.
