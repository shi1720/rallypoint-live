# Rallypoint

**Tagline:** Give every new arrival a way into the story.

**Creator:** Shivam Gupta

**Repository:** https://github.com/shi1720/rallypoint-live

**Try it:** https://rallypoint-live-shivam.sg127977958.chatgpt.site — owner-private initially; public judging access still needs verification.

**Video:** USER ACTION NEEDED — insert the public YouTube URL after recording the real Twitch demonstration.

**Codex session ID:** `01a181e2-464a-7302-821d-a300d09b283c` (main build chat; confirm with /status before copying).

## Inspiration

Joining a live stream halfway through can feel like walking into a room where everyone knows the story except you. A welcome alert says hello. A summary explains the past. We wanted to make the next step obvious: what are we trying to do, why does it matter, and how can I help right now?

## What it does

Rallypoint is a participation desk for Twitch communities. A creator publishes one short brief: the current goal, context, stakes, an exact `!join A` or `!join B` action and an expiry. New arrivals can read it on the public page, see it on an OBS overlay or request it in chat with `!catchup`.

The community helps maintain the story through `!pitch`. Suggestions enter a review queue; they do not automatically become stream copy. The creator can reject misleading proposals and incorporate useful context into the next approved brief. Incoming Twitch raids receive a welcome connected to the current moment. Valid participation commands become visible counts, and expired or closed briefs stop inviting people into a finished choice.

## Why this approach

Rallypoint focuses on the bridge from understanding to participating. Native summaries and capable AI bots already exist. Our contribution is a small, creator-controlled workflow that keeps the same actionable brief across the desk, chat, public page and overlay.

The runtime is deterministic and needs no OpenAI API key. That keeps the core inexpensive to run and makes it possible to inspect how a suggestion, command or event changes the published state.

## How we used Codex

Shivam Gupta set the ambition, directed the product scope and emphasized commercial viability, free-first operation and an honest, usable end-to-end experience. Codex supported research, implementation, test development and documentation. The repository preserves the actual implementation and verification instructions so that judges can evaluate the work directly.

## Commercial direction

Our starting segment is creators running recurring community challenges, maker sessions and tabletop campaigns. Self-hosting has a $0 software price; a proposed $12/month managed creator plan is a hypothesis to validate. There is no claimed paid checkout, customer traction or retention improvement. We measure actual command participation and plan creator pilots to learn whether the workflow earns repeat use.

## Challenges and lessons

The hard part is keeping a live invitation trustworthy when the situation changes. Moderation, expiry and consistent state matter as much as the visual overlay. We also learned to narrow the idea after researching existing recap tools: repeating an established AI-summary feature would miss the more useful opportunity to help someone join the next moment.

## Verification and next steps

The implementation passes 59 engine/security tests and 15 local HTTP integration checks. Tests exercise signatures, replay protection, expiry, moderation boundaries and actual local D1 concurrency. Browser review verifies the rehearsal workflow. These checks do not establish live Twitch behavior. Record authentic OAuth connection, real chat commands and overlay updates; label any simulated raid explicitly. Future creator pilots will test maintenance burden and willingness to pay.

**Built with:** TypeScript, React, Twitch OAuth, Twitch EventSub, OBS browser source and OpenAI Codex. Cloudflare Workers, Cloudflare D1 and Sites-managed authentication.
