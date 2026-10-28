# Testing Rallypoint

App: https://rallypoint-desk.web.app
Source: https://github.com/shi1720/rallypoint-live

## No-credentials sample

1. Open `https://rallypoint-desk.web.app/demo` in a normal browser.
2. Confirm that the rehearsal banner explicitly labels the chat, names, raids, and metrics as simulated.
3. Select **A newcomer joins in**. The current decision count increases by one.
4. Send `!join B` using the same fictional viewer name. After the short cooldown, the choice changes without adding a second voter.
5. Select **Send a raid**. Open the viewer page from the desk and check the 90-second welcome.
6. Select **Test creator control**. Open **Community inbox**. The untrusted pitch is pending and must not appear on the viewer page.
7. Dismiss that pitch. Accept a useful pitch, choose **Use in next brief**, edit its wording, and explicitly publish. Acceptance alone must not change the public brief.
8. Open the viewer page and overlay preview in the same browser. Close the chapter in the desk. The previous participation command must stop appearing across those tabs.
9. Reset the rehearsal to restore the initial fictional scenario.

These interactions exercise the same state machine as live ingestion. They do not contact a real Twitch channel.

## Real private workspace

1. Open `https://rallypoint-desk.web.app/signin`.
2. Choose **Try a workspace** to create a real guest workspace, or create/sign into an email/password account. A returning browser may show **Open saved workspace** instead.
3. Confirm that a new workspace starts empty. It must not contain fictional contributions or claim Twitch is connected.
4. Publish a brief from a template. Open its viewer URL in another browser or a signed-out window. The approved brief and aggregate results are readable; the review queue and participant identities are not public.
5. Edit and republish the brief. A new chapter must start fresh decision counts. A conflicting stale editor must fail instead of replacing the newer version.
6. In **Channel setup**, export the session. Select **Start new session**, read the confirmation, and acknowledge that anything to keep has been exported. Reset clears session history while retaining public links and Twitch authorization.
7. Sign out. Reopening `/studio` must require sign-in. Guest users should create an account before signing out if they want dependable access across devices.

Guest state is real server-side state, owned by the browser's verified Firebase identity. Clearing the browser's stored identity before upgrading can make the guest workspace inaccessible.

## Real Twitch and OBS

The public deployment already has operator credentials configured. Testers need a broadcaster account they control and can connect it from Channel setup. For an independent deployment, first register and configure your own confidential Twitch application. No shared test account, passwords, or Twitch secrets are included in the repository.

1. On the public deployment, open **Channel setup** in the creator desk and select **Connect Twitch**. For an independent deployment, first follow the operator setup in the README with the exact callback `https://rallypoint-desk.web.app/api/twitch/callback`.
2. Authorize the broadcaster account you control and review the requested chat/bot scopes.
3. Verify that both chat and incoming raid subscriptions become enabled. A pending authorization is not proof of event delivery.
4. Publish a current brief and type real `!catchup`, `!join A`, `!join B`, and `!pitch Useful context` commands in that channel.
5. Observe actual chat replies, decision changes, and the private inbox. Review a pitch and explicitly publish any text chosen for the brief.
6. If using the optional OBS overlay, add the actual overlay URL as a Browser Source at 1280 by 720. Confirm that changes reach OBS and that its background is transparent.
7. Close or expire the chapter. Confirm that old participation stops in chat, on the viewer page, and in OBS when used.
8. Use a genuine incoming raid when available. If demonstrating a simulated raid, keep a visible simulation label and describe it accurately.

Until these steps are observed, real Twitch authorization, real message delivery, and actual OBS behavior remain unverified.

## Automated verification

```sh
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

For the designated operator deployment suite:

```sh
TEST_ORIGIN=https://rallypoint-desk.web.app node --experimental-strip-types tests/deployed-e2e.mjs
```

The operator suite needs authenticated Google Cloud CLI access to the designated deployment and permissions for its disposable fixtures. It verifies actual Firebase sessions, owner isolation, real Firestore transactions, public projections, signed fixture ingress, and reset/export behavior, then removes its fixtures. Never use it against an unrelated project.

See `docs/verification.md` for the latest observed results and limits. An automated fixture result does not substitute for the real Twitch/OBS steps above.
