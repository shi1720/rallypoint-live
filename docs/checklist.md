# Submission readiness

Use this as a release gate. An unchecked item is unresolved; this checklist does not certify eligibility, deployment or test success.

## Required submission

- [ ] Shivam personally verifies eligibility, residence and conflicts under the [official rules](https://twitchcon-codex.devpost.com/rules).
- [ ] Join the hackathon and complete all Devpost fields by **November 3, 2026, 3:30 a.m. IST**.
- [x] Supply an accessible repository with source, assets and runnable instructions; grant the specified judging access if private.
- [x] Prepare a project description and main Codex build session ID. Confirm /status at final entry.
- [ ] Upload a public YouTube demo under three minutes, showing the project on Twitch and its Codex development.
- [ ] Keep free, unrestricted judging access available through November 15.
- [ ] Confirm required English materials, asset rights and accurate authorship claims.

## Real Twitch proof — USER ACTION NEEDED until observed

- [ ] Register or select the Twitch app, configure the exact deployment callback and provide server-side credentials.
- [ ] Complete Twitch OAuth consent using Shivam's authorized account.
- [ ] Verify real `!catchup`, `!pitch` and `!join A/B` behavior in Twitch chat.
- [ ] Verify a published change reaches the public page and the actual OBS browser source.
- [ ] Verify moderation rejection never publishes the rejected proposal.
- [ ] Verify a closed/expired brief no longer accepts participation.
- [ ] Record a genuine incoming raid, or label its demonstration as simulated throughout.
- [ ] Confirm no rehearsal fixture is presented as live Twitch traffic.

Twitch app registration requires a verified account and 2FA; see [Twitch's registration instructions](https://dev.twitch.tv/docs/authentication/register-app/). Keep the client secret confidential. The running app's connection/settings screen and README are authoritative for the final callback and environment-variable names.

## Release evidence — USER ACTION NEEDED until report exists

- [x] Run the repository's documented automated checks and production build; save actual results.
- [ ] Inspect error paths, duplicate events, expired actions, authorization and tenant separation using the final implementation.
- [x] Confirm locally that EventSub authenticates messages and handles redelivery; compare with [Twitch's webhook guidance](https://dev.twitch.tv/docs/eventsub/handling-webhook-events/).
- [ ] Test the final deployed version, signed-out public access and narrow-screen readability.
- [ ] Replace all `USER ACTION NEEDED` fields in the copied Devpost submission with verified facts/links.
- [ ] Ensure the README and final submission distinguish simulated verification from live verification.
- [ ] Keep pricing, traction and test claims within the evidence. There is no implemented paid checkout or validated retention lift asserted here.

## Final links

| Item                           | Value                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------- |
| Code repository                | https://github.com/shi1720/rallypoint-live                                        |
| Deployed project / judge entry | https://rallypoint-live-shivam.sg127977958.chatgpt.site (initially owner-private) |
| Public viewer page             | USER ACTION NEEDED                                                                |
| Public YouTube video           | USER ACTION NEEDED                                                                |
| Codex session ID               | 01a181e2-464a-7302-821d-a300d09b283c                                              |
| Final verification report      | docs/verification.md                                                              |

The rules' four criteria are equally weighted: innovation, potential impact, implementation and design. Review each against what the final recording actually demonstrates. No score predicts an award.
