# Rallypoint demo narration

The finished V2 is 2:44.73. Read the paragraphs below verbatim; do not speak the headings. The real-channel segment uses actual timestamped Twitch screenshots with idle time omitted. All sample chat, names, raids and metrics remain explicitly simulated.

## A way into the story

You arrive halfway through a stream. Everyone knows why the bridge matters. You don't. Rallypoint gives you a way into the story: the goal, the stakes, and one clear thing you can do next.

## One current brief

This is the creator's participation desk. We'll use a sample rescue, with simulated chat and raid events, to show the workflow. Bubbles is stranded across a ravine. Choose a starter, set the context, and publish a brief with two rescue routes and an expiry. The same approved version reaches the viewer page and OBS overlay.

## Real Twitch chat

Now here's the same workflow in a real Twitch channel. The broadcaster authorized Rallypoint. Typing exclamation mark catchup in Twitch chat returns the published brief. Exclamation mark join A sends a contribution through Twitch EventSub. Back in Rallypoint, the count updates for this chapter. Those are real Twitch messages, using the same one vote per viewer rule.

## Make the next step obvious

Viewers can type exclamation mark catchup to get the approved brief. Exclamation mark join A means build a bridge. Join B means dig a tunnel. Each person gets one vote per decision. Changing sides updates that vote, so repeated messages cannot inflate the count.

## Community context, creator control

The community can help keep the context current. A pitch enters the review queue with its source message. A false update stays private. Accepting a useful suggestion saves it for editing. It still needs a separate publish action. The creator chooses every word that reaches the audience.

## An invitation for incoming communities

When a raid arrives, the current brief becomes a welcome for that community. The desk counts contributions during the welcome window. These are observed actions, not a claim about viewer retention.

## No stale invitations

When the decision ends, close the chapter. The old action disappears across the viewer page and overlay. Expiry does the same thing. If a page loses its connection, it hides participation commands until it can confirm fresh context.

## A small, inspectable core

Shivam Gupta built Rallypoint with OpenAI Codex, using it to research alternatives, implement the interface, review security, and test the event pipeline. The core needs no model API calls, audio recording, or per-message inference budget. The source and verification instructions are available on GitHub.

## Give every viewer a way in

Rallypoint is for communities with a story in progress: shared challenges, creative builds, and tabletop campaigns. Help the next person understand the moment, then give them a part to play.
