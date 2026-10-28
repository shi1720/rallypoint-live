# Why Rallypoint exists

Research checked October 28, 2026. Product descriptions below are vendors' published claims, not independently measured performance.

**The opportunity is helping a newcomer participate in the next moment.** Summarizing the previous moment is already a crowded category. Rallypoint's brief combines the current goal, context, stakes, an exact chat action and an expiry. The streamer controls what becomes public; the community can contribute through a review queue.

## Competitive reality

| Product                                                                                                                  | Published capability                                                                        | Rallypoint's intended distinction                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Twitch Mid-Stream Summaries](https://blog.twitch.tv/en/2026/05/30/everything-we-announced-at-twitchcon-rotterdam-2026/) | Twitch announced brief synopses for people arriving midway.                                 | A structured action that viewers can take now, with creator approval and an explicit end.           |
| [CatchUp.help](https://catchup.help/)                                                                                    | Audio-based live summaries, `!recap`/`!catchup`, bot integrations and post-stream chapters. | Community-supplied context and deterministic publication; no continuous transcription bill.         |
| [Luro](https://www.getluro.com/)                                                                                         | Contextual live Q&A, lore/rules explanations, coaching and recap.                           | A focused participation desk rather than a broad assistant speaking for the creator.                |
| [Pleiros](https://www.pleiros.com/)                                                                                      | Living memory, summaries, event reactions and raid welcomes.                                | One approved brief shared by the desk, public page, chat and OBS; contributions tied to that brief. |
| [Nightbot](https://docs.nightbot.tv/setup)                                                                               | Custom information commands and scheduled messages.                                         | A maintained, expiring workflow with a proposal queue and participation counts.                     |
| [Streamer.bot](https://docs.streamer.bot/api/triggers/twitch/raid/raid)                                                  | Raid-triggered automations.                                                                 | A ready-to-use editorial workflow around arrival, understanding and action.                         |

This comparison does **not** establish that no competing product has a similar workflow. Do not describe Rallypoint as the first, patentable or competition-free.

## The wedge to demonstrate

A maker is rescuing a failed build. A newcomer should learn what broke, why today's attempt matters and whether to type `!join A` or `!join B`. A community member supplies missing context through `!pitch`; a moderator decides whether it belongs in the brief. An incoming raid receives that same approved context. When the choice ends, its expiry prevents a stale invitation from remaining on screen.

The useful contrast is between **information consumed** and **an action understood**. The demo should show the entire transition: arrive, understand, participate, update or close the brief.

## What the evidence does and does not establish

- Existing vendors and Twitch invest in late-arrival context. That supports the existence of a product category, not demand for this implementation.
- A narrow, lower-cost workflow can be useful even beside native summaries. Willingness to pay for it remains untested.
- Approved community context avoids asking a model to infer events from raw audio. It still depends on editorial accuracy and timely updates.
- Participation counts are observed chat actions. They are not viewer retention, revenue lift or proof that a raid caused an action.
- Do not identify individual viewers as raid arrivals. [Streamer.bot's changelog](https://streamer.bot/changelogs) explains why its old inferred raider-name list was removed after the public chatter endpoint changed.

## Build priorities implied by the research

1. Make the current action legible in seconds on both a phone and an OBS frame.
2. Keep pending proposals out of all public surfaces.
3. Treat expiry, duplicate deliveries and chapter changes as core behavior.
4. Give judges an immediate rehearsal, clearly labeled as simulated, alongside an authentic Twitch path.
5. Tell a concrete creator story; avoid claims about replacing moderators or generating engagement automatically.
