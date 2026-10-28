# Release and submission checklist

An unchecked item is unresolved. This checklist does not certify eligibility, a completed deployment, or a live Twitch test.

## Application release

- [x] Verify the exact release at https://rallypoint-desk.web.app while signed out.
- [x] Verify the sample scenario is labeled as simulated.
- [x] Verify real guest and email/password sessions, owner isolation, sign-out, and guest upgrade.
- [x] Verify publish/edit/close, stale confirmations, export, and real session reset.
- [x] Verify viewer and overlay freshness behavior, including disconnected Twitch readiness.
- [x] Run the current domain/security/storage checks, TypeScript, build, dependency audit, and deployed operator suite.
- [x] Record the exact revision, test results, CI status, and browser review evidence in `docs/verification.md`.
- [x] Confirm responsive layout and accessible dialog/form controls at desktop and phone widths.
- [x] Confirm deployment secrets are excluded from source and build context.

## Real Twitch proof

- [x] Configure the confidential Twitch app with `https://rallypoint-desk.web.app/api/twitch/callback`.
- [x] Authorize the broadcaster and verify enabled chat and incoming raid subscriptions.
- [x] Exercise real `!catchup`, `!join A/B`, and `!pitch` commands and observe actual replies/state updates.
- [x] Verify rejected rehearsal pitches stay off the public brief and a real accepted pitch still requires explicit publication.
- [ ] Verify the actual OBS Browser Source updates and has a transparent background.
- [x] Verify closure ends real Twitch participation and removes the viewer invitation; signed fixtures and browser checks cover expiry.
- [ ] Verify that end-state behavior in native OBS.
- [x] Keep simulated raid demonstrations visibly and verbally disclosed.
- [ ] Observe a genuine incoming raid when available.

## Entry materials

- [x] Observe completed personal attestations in the submitted entry. Eligibility remains the entrant's responsibility under the [official rules](https://twitchcon-codex.devpost.com/rules); the agent does not independently certify it.
- [x] Review the Project Story in `docs/devpost-submission.md` and the actual current feature set.
- [x] Provide the public source repository: https://github.com/shi1720/rallypoint-live.
- [x] Provide tester instructions and public access without a paywall. Keep the deployment available through the judging period.
- [x] Verify the main Codex build session ID before entering it.
- [x] Upload and verify a public YouTube video under three minutes with legible authentic functionality and a concise Codex development segment.
- [x] Save the user-provided residence and Codex survey answers.
- [x] Observe Devpost displays Submitted and 5/5 steps done after the user-facing handoff.
- [x] Observe the disabled Project submitted control. The agent did not perform the final prize-entry action.
- [ ] Replace the submitted video URL with the verified genuine-chat cut before **November 3, 2026 at 3:30 a.m. India time**.

## Submission location

https://devpost.com/submit-to/31742-codex-x-twitchcon-hackathon/manage/submissions/1268954/project-overview

The submitted entry includes the public YouTube walkthrough at https://www.youtube.com/watch?v=CbFh_5jZIUE and the main build session ID verified from the Codex runtime. Twitch app registration, 2FA, developer authorization and secure credential configuration are complete. Broadcaster chat access and actual test commands are now verified in shi1720. The replacement public video is being prepared from those captures. Preserve the connected guest identity and upgrade before clearing browser data.

The four criteria are equally weighted: innovation, potential impact, implementation, and design. A private review score does not predict an award. Source fixtures, browser screenshots, and a real Twitch recording establish different things and must remain clearly identified.
