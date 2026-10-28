# Start here

Rallypoint is implemented, deployed and available as source. The remaining release gates require account access and the real demonstration.

## Open the product

Hosted app: https://rallypoint-live-shivam.sg127977958.chatgpt.site/demo . Initial access is owner-only. GitHub: https://github.com/shi1720/rallypoint-live . Green CI for the initial release: https://github.com/shi1720/rallypoint-live/actions/runs/40670486611 .

Code commit deployed: `b472d5b336d9e6f3fa176b8853729485d056f127`. Version 1 was successfully published. An authenticated service check of the deployed `/api/health` returned 200; the same service access to `/api/room` without a signed-in user returned 401, as intended. Service access is not a replacement for a person's sign-in.

The creator desk uses ChatGPT sign-in. It then connects to the broadcaster's Twitch account. Local development uses mock sign-in and cannot establish that production identity flow has been completed.

## The only external steps now

1. **Public judging access.** Explicitly authorize making this Site public. The public landing/rehearsal/viewer/overlay and Twitch webhook need anonymous access. Studio writes remain owner-authenticated.
2. **Twitch.** Sign in at https://dev.twitch.tv/console/apps. Register/select a confidential app. Use this exact OAuth callback: `https://rallypoint-live-shivam.sg127977958.chatgpt.site/api/twitch/callback`. The production environment already contains random encryption and webhook secrets plus SITE_URL. It still needs `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. After those are configured, authorize the broadcaster in Channel setup and verify both EventSub subscriptions.
3. **Live proof and video.** Use the supplied script. Show actual Twitch `!catchup`, `!join A`, `!pitch`, review/publish, and OBS updates. An incoming raid may be simulated only with clear disclosure. Record narration and upload the under-three-minute video publicly to YouTube. Do not claim the rehearsal is real Twitch traffic.
4. **Personal declarations and final entry.** Verify age, residence and conflicts yourself. Review the Devpost draft, fill the missing video, eligibility and personal survey fields, then submit before **November 3, 2026 at 3:30 a.m. India time**. No final entry has been submitted.

## Devpost draft

The existing blank draft is now named Rallypoint. Name, pitch, project story, TypeScript tag and repository link were saved. The additional-info page has factual repository/session/technology/use-case fields prepared in the browser, but that page has **not** been saved because personal declarations are still missing. Browser values can be lost on reload; the source text is preserved in the submission document.

Draft: https://devpost.com/submit-to/31742-codex-x-twitchcon-hackathon/manage/submissions/1268954-rallypoint/additional-info/edit . Preview: https://devpost.com/software/rallypoint-y08snc . The draft is incomplete and is not a submitted contest entry.

## Deliverables

- `../rallypoint-field-guide.pdf`: four-page product/recording/business guide.
- `../rallypoint-source.zip`: runnable source checkpoint with no production secrets.
- `docs/script.md`: word-for-word narration and timed shot list.
- `docs/devpost-submission.md`: project story and accurate Codex credit.
- `docs/verification.md`: 59 engine/security tests, 15 local HTTP checks, browser review and limits.
- `docs/business-plan.md`: pricing and economics assumptions, creator interviews and pilot go/no-go criteria.
- `docs/research.md`: competitor evidence and positioning.
- `docs/checklist.md`: unresolved submission requirements.
- Editable six-slide pitch: ChatGPT Page `page_d521ae77fbf48191a45ec0a198e21389`, artifact `artifact_external_908df26a-aa26-43a0-b927-498c668a7d4b`.

Main Codex build session: `01a181e2-464a-7302-821d-a300d09b283c`. Confirm /status at final submission. Supporting agents did not replace this main build chat.

We have not claimed validated demand, paying customers, a retention lift, large-channel capacity or completed live Twitch authorization. Those remain explicit tests, not assumed successes.
