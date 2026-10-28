# Start here

**Application:** https://rallypoint-desk.web.app
**Repository:** https://github.com/shi1720/rallypoint-live
**Public video:** https://www.youtube.com/watch?v=W0e7IDiO93g
**Devpost preview:** https://devpost.com/software/rallypoint-y08snc

The current source uses native Next.js, Firebase Authentication, the named `rallypoint` Firestore database, Cloud Run, and Cloud Tasks. The earlier private Sites URL and mock ChatGPT sign-in are no longer the testing path.

## Explore and test

- `/demo` is a clearly labeled simulated scenario with no account required.
- `/signin` creates a real private guest workspace or signs into an email/password account. A guest can add credentials without changing the workspace UID.
- `/studio` contains publication, review, insights, Twitch setup, export, sign-out, and guarded session reset.
- Each real workspace creates its own read-only viewer and OBS links.

Follow `docs/testing-instructions.md`. The operator's deployed suite is `tests/deployed-e2e.mjs`; it needs Google Cloud access and uses disposable signed fixtures. It is not a substitute for real Twitch proof.

## Release status and ownership

- Real broadcaster authorization, both enabled EventSub subscriptions, actual catchup replies, one-vote replacement, private pitch review, separate publication and closed-chapter refusal passed. See `docs/live-twitch-verification.json`.
- The updated 2:45 video is public, with genuine Twitch proof at 00:36 to 01:03 and a published manual English subtitle track. Devpost retained its new URL. The older V1 is unlisted.
- Devpost displays Submitted, 5/5 steps done, with completed personal attestations. The agent observed that state and did not perform the final prize-entry action. The story and technology explanation include real Twitch results.
- Preserve the connected shi1720 workspace in this browser. Use **Create an account** to upgrade the guest identity before clearing browser data or signing out. The original public links and connected state survived tab cleanup and reopening.
- Native OBS verification and a genuine incoming raid remain unverified. OBS is optional for the web app and chat workflow. Raid demonstrations remain explicitly simulated.

Rallypoint Desk is registered under shi1720 with the canonical Firebase callback. Its credentials were validated with Twitch and stored in Google Secret Manager for the deployed backend. Temporary local credential files were removed. Cloud Run revision `rallypoint-00008-mwh` serves the same verified application source `06e5005`. The real chat pipeline has now passed the manual provider checks. A genuine incoming raid and native OBS remain unverified. Do not pass the sample or signed fixtures off as real Twitch traffic.

## Submission materials

- `docs/devpost-submission.md`: requested Project Story headings and product explanation.
- `docs/testing-instructions.md`: tester paths for the sample, real workspace, and live Twitch/OBS.
- `docs/business-plan.md`: explicit commercial hypotheses and creator validation plan.
- `docs/research.md`: competitive evidence and positioning.
- `docs/verification.md`: verification scope and honest release limits.
- `docs/checklist.md`: remaining entry gates.

The final video, narration, SRT/VTT captions, thumbnail, metadata and production report are in the delivery folder alongside the source repository. The four-page field guide describes the Firebase release and links to the public video. The supplementary deck is a separate pitch aid, not evidence of authentic Twitch activity.

Main Codex build session, verified from the Codex runtime and entered in the submission: `01a181e2-464a-7302-821d-a300d09b283c`.

Shivam Gupta is the creator and directed the product ambition, commercial constraints, and review priorities. Codex assisted with research, implementation, testing, refinement, and documentation. No fictional creator interviews, paid traction, retention lift, or human contributions have been added to the record.
