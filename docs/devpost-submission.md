# Rallypoint

**Tagline:** Give every Twitch viewer a way in. One approved brief connects the current goal to a clear action in chat.

**Creator:** Shivam Gupta
**Application:** https://rallypoint-desk.web.app
**Repository:** https://github.com/shi1720/rallypoint-live
**Main Codex session:** `01a181e2-464a-7302-821d-a300d09b283c`

Use the sections below as the Project Story. The video URL belongs in the separate video field after the public upload is verified.

## Inspiration

You arrive halfway through a stream. Someone shouts, “Save Bubbles!” Chat is choosing between a bridge and a tunnel. Everyone else knows why it matters. You are still trying to work out who Bubbles is.

A welcome alert can say hello. A summary can explain what happened. We wanted to make the next step clear: what is the community trying to do right now, why does it matter, and how can the next person help?

That question shaped Rallypoint. We focused on creators running shared challenges, collaborative builds, and ongoing tabletop stories, where context changes and new arrivals deserve a role in the next moment.

## What it does

Rallypoint is a participation desk for Twitch. A creator publishes one short brief with the current goal, context, stakes, choices, and expiry. The same approved version powers a shareable viewer page, an OBS browser-source overlay, and the `!catchup` chat response.

Viewers can type `!join A` or `!join B` to take part in the current decision. Each viewer has one vote per chapter and can change their choice. They can also suggest useful context through `!pitch`. A pitch enters the private review queue. Accepting it saves it for editing; only an explicit publish action makes revised context public.

An incoming raid can display a welcome beside the current brief. Closing or expiring a chapter ends its invitation. Public pages hide live commands when fresh state or channel readiness cannot be confirmed. Participation insights count observed actions, not inferred raiders or viewer retention.

A clearly labeled sample scenario lets anyone explore the workflow without an account. Real guest workspaces and email/password accounts support publishing, private review, export, and guarded session resets.

## How we built it

Shivam Gupta directed the product ambition, practical scope, operating-cost constraints, and verification priorities. Codex supported competitor research, implementation, interface refinement, test development, and code review.

The app runs on native Next.js and React, with Firebase Hosting providing the clean URL. Cloud Run serves the application. Firebase Authentication verifies users, and the server exchanges fresh ID tokens for secure sessions. Private operations check the authenticated owner.

A named Cloud Firestore database stores transactional state, event receipts, encrypted Twitch authorization, and a separate sanitized public snapshot. Cloud Tasks processes committed chat replies. Twitch OAuth, EventSub, and Helix connect broadcaster authorization, signed events, and chat responses.

The sample scenario and live ingestion share one deterministic state engine. The runtime does not need an OpenAI API key or continuous transcription. Codex is the development collaborator, while the creator controls what reaches the stream.

## Challenges we ran into

Live context becomes unreliable quickly if a finished choice remains on screen. We treated expiry, chapter versions, delayed events, and stale confirmations as core behavior. An old close dialog must not end a newer decision. A repeated delivery must not duplicate a contribution.

Moving to Firebase also required a real platform migration. Rehosting the frontend alone would have left authentication and storage dependent on the previous environment. We replaced those dependencies, accounted for Firebase Hosting's session-cookie behavior, and separated public reads from private session storage. We also bounded and compressed private state to respect Firestore's document size limit.

## Accomplishments that we're proud of

The strongest result is a small workflow with clear boundaries. A newcomer gets an exact next action. A creator retains editorial control. A community contribution can improve the brief without automatically becoming public stream copy.

The implementation includes version checks, signed event verification, replay handling, owner isolation, encrypted authorization, public-data minimization, and session export/reset. The test suite covers failure cases as well as the intended path. The deployed test suite uses actual Firebase identities and Firestore transactions, while keeping signed fixtures distinct from real Twitch traffic.

The current verification record is linked in the repository. Actual Twitch authorization, real channel traffic, and OBS capture must be checked separately; a simulated sample is not presented as proof of those external integrations.

## What we learned

Research showed that late-arrival summaries and capable chat bots already exist. A narrower participation handoff gave us a clearer product than another broad AI assistant.

We also learned that lower model costs do not remove operational costs. Polling, storage, authentication, retries, and moderator effort still matter. Useful metrics need equally clear definitions: a command during a raid welcome is an observed action, not proof of retention.

## What's next for Rallypoint

We will test the workflow with creators who run recurring challenges and collaborative streams. The next questions are whether maintaining a brief saves effort, whether creators reuse it on another stream, and whether newcomers understand their next move faster.

A proposed managed plan at $12 per month is a pricing hypothesis, not an implemented checkout or claimed revenue. Six creator interviews and three pilots will test demand before expanding into team moderation or additional premium features. The immediate release gate is authentic Twitch authorization, real commands, and OBS footage using the current Firebase deployment.
