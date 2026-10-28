# Release and submission checklist

An unchecked item is unresolved. This checklist does not certify eligibility, a completed deployment, or a live Twitch test.

## Application release

- [ ] Verify the exact release at https://rallypoint-desk.web.app while signed out.
- [ ] Verify the sample scenario is labeled as simulated.
- [ ] Verify real guest and email/password sessions, owner isolation, sign-out, and guest upgrade.
- [ ] Verify publish/edit/close, stale confirmations, export, and real session reset.
- [ ] Verify viewer and overlay freshness behavior, including disconnected Twitch readiness.
- [ ] Run the current domain/security/storage checks, TypeScript, build, dependency audit, and deployed operator suite.
- [ ] Record the exact revision, test results, CI status, and browser review evidence in `docs/verification.md`.
- [ ] Confirm responsive layout and accessible dialog/form controls at desktop and phone widths.
- [ ] Confirm deployment secrets are excluded from source and build context.

## Real Twitch proof

- [ ] Configure the confidential Twitch app with `https://rallypoint-desk.web.app/api/twitch/callback`.
- [ ] Authorize the broadcaster and verify enabled chat and incoming raid subscriptions.
- [ ] Exercise real `!catchup`, `!join A/B`, and `!pitch` commands and observe actual replies/state updates.
- [ ] Verify review rejection never publishes private text, and accepting still requires explicit publication.
- [ ] Verify the actual OBS Browser Source updates and has a transparent background.
- [ ] Verify close/expiry ends the old participation action across all surfaces.
- [ ] Record a genuine raid or keep its simulation visibly and verbally disclosed.

## Entry materials

- [ ] Shivam personally verifies age, residence, conflicts, and eligibility under the [official rules](https://twitchcon-codex.devpost.com/rules).
- [ ] Review the Project Story in `docs/devpost-submission.md` and the actual current feature set.
- [ ] Provide the public source repository: https://github.com/shi1720/rallypoint-live.
- [ ] Provide tester instructions and keep free judging access available through the judging period.
- [ ] Verify the main Codex build session ID before entering it.
- [ ] Upload and verify a public YouTube video under three minutes with legible authentic functionality and a concise Codex development segment.
- [ ] Complete personal survey fields and any required declarations honestly.
- [ ] Review all saved Devpost fields and submit before **November 3, 2026 at 3:30 a.m. India time**.

## Draft location

https://devpost.com/submit-to/31742-codex-x-twitchcon-hackathon/manage/submissions/1268954/project-overview

The four criteria are equally weighted: innovation, potential impact, implementation, and design. A private review score does not predict an award. Source fixtures, browser screenshots, and a real Twitch recording establish different things and must remain clearly identified.
