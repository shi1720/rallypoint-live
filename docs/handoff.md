# Start here

**Application:** https://rallypoint-desk.web.app
**Repository:** https://github.com/shi1720/rallypoint-live
**Public video:** https://www.youtube.com/watch?v=CbFh_5jZIUE
**Devpost preview:** https://devpost.com/software/rallypoint-y08snc

The current source uses native Next.js, Firebase Authentication, the named `rallypoint` Firestore database, Cloud Run, and Cloud Tasks. The earlier private Sites URL and mock ChatGPT sign-in are no longer the testing path.

## Explore and test

- `/demo` is a clearly labeled simulated scenario with no account required.
- `/signin` creates a real private guest workspace or signs into an email/password account. A guest can add credentials without changing the workspace UID.
- `/studio` contains publication, review, insights, Twitch setup, export, sign-out, and guarded session reset.
- Each real workspace creates its own read-only viewer and OBS links.

Follow `docs/testing-instructions.md`. The operator's deployed suite is `tests/deployed-e2e.mjs`; it needs Google Cloud access and uses disposable signed fixtures. It is not a substitute for real Twitch proof.

## External release gates

1. Configure the Twitch application's client ID and confidential secret. Its redirect must be `https://rallypoint-desk.web.app/api/twitch/callback`.
2. Authorize a broadcaster account that the tester controls. Verify enabled chat and incoming raid subscriptions, real commands/replies, and the actual OBS Browser Source.
3. Review the personal eligibility attestations in Devpost and perform the final entry submission yourself. The story, media, links, creator credit and user-supplied survey answers are saved. A prepared draft is not a final submitted entry.

Twitch is signed in as shi1720. Registration of Rallypoint Desk is prepared and authorized, but Twitch requires the account owner to enable two-factor authentication before it allows creation. The account-specific Twitch steps remain unverified until actually observed. Do not pass the sample scenario or signed fixtures off as real Twitch traffic.

## Submission materials

- `docs/devpost-submission.md`: requested Project Story headings and product explanation.
- `docs/testing-instructions.md`: tester paths for the sample, real workspace, and live Twitch/OBS.
- `docs/business-plan.md`: explicit commercial hypotheses and creator validation plan.
- `docs/research.md`: competitive evidence and positioning.
- `docs/verification.md`: verification scope and honest release limits.
- `docs/checklist.md`: remaining entry gates.

The final video, narration, SRT/VTT captions, thumbnail, metadata and production report are in the delivery folder alongside the source repository. The four-page field guide describes the Firebase release and links to the public video. The supplementary deck is a separate pitch aid, not evidence of authentic Twitch activity.

Main Codex build session, verified from the Codex runtime and entered in the draft: `01a181e2-464a-7302-821d-a300d09b283c`.

Shivam Gupta is the creator and directed the product ambition, commercial constraints, and review priorities. Codex assisted with research, implementation, testing, refinement, and documentation. No fictional creator interviews, paid traction, retention lift, or human contributions have been added to the record.
