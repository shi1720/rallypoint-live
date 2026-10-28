# Rallypoint — commercial hypothesis

**Initial customer:** a Twitch creator running recurring community challenges, maker/build sessions or tabletop campaigns, with a moderator or co-host who can maintain a brief. These streams have changing goals and stakes that returning regulars understand but new arrivals may not.

**Job to be done:** “When someone joins halfway through, help them understand the current moment and take part without making me stop and repeat the setup.”

There are no claimed customers, interviews, revenue or retention results at submission time. This document is a test plan, not evidence of traction.

## Product and pricing

The core is a participation desk: publish goal/context/stakes/action/expiry, review `!pitch` suggestions, answer `!catchup`, count valid `!join A/B` commands and welcome raids using the current approved brief. The public page and OBS overlay distribute that brief.

The runtime is deterministic. It does not require an OpenAI API key, continuous audio capture or token spending. Codex was the development tool.

| Offer               | Proposed terms                                                                                          | Status                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Self-host           | $0 software price; operator supplies hosting, configuration and maintenance.                            | Run from source; infrastructure is not universally free.                                 |
| Hosted creator plan | **$12/month**, one channel; managed operation, saved workflows and branding as the proposed paid value. | Pricing hypothesis only. No paid checkout or subscription is represented as implemented. |
| Judging access      | Free, unrestricted evaluation of the submitted project.                                                 | Must remain available throughout judging.                                                |

Do not gate the hackathon demonstration behind payment. Do not promise unimplemented premium features in a checkout flow.

## Unit economics: assumptions to verify

Illustrative operating model for **100 paying channels**, each streaming 40 hours/month. These are budgeting assumptions, not a hosting quote or a load-test result.

| Input                             | Assumption                          | Monthly consequence                                                             |
| --------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------- |
| Price                             | 100 × $12                           | $1,200 gross receipts before tax/refunds                                        |
| Stream activity                   | 4,000 channel-hours total           | Size the service for simultaneous streams, not this total alone                 |
| Viewer-page load                  | Average 20 open pages/channel-hour  | 80,000 page-hours; polling strategy is material                                 |
| Implemented 3-second polling      | 1,200 requests/page-hour            | 96 million requests, plus creator desks/overlays/events                         |
| Runtime inference                 | No LLM calls                        | $0 inference expense for core behavior                                          |
| Infrastructure reserve            | $100/month                          | Planning reserve; replace with measured request, CPU, database and egress bills |
| Payment allowance                 | 4% of gross receipts                | $48; placeholder, not a provider fee quote                                      |
| Support                           | 5 minutes/channel/month at $20/hour | About $167; excludes onboarding, incidents and development                      |
| Contribution after these reserves | $1,200 − $100 − $48 − $167          | About $885/month, or 74%; not net profit                                        |

Polling can dominate costs even without AI. Cache public reads, minimize payloads, cap stored event history, and move to more efficient updates only when observed load justifies it. Confirm the deployed implementation's actual interval before estimating its bill.

Cloudflare publishes usage-based [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/). Its D1 free tier currently includes daily read/write allowances and storage, but shared deployments and polling can exhaust free limits. Sites hosting may have separate account terms. A free tier is a starting option, not a promise of free production operation.

## Distribution and defensibility

Start with creator-led onboarding and reusable challenge/maker/tabletop brief examples. Ask permission before contacting creators. Help one moderator set up one real stream, then observe whether they voluntarily reuse it. A short clip showing a newcomer joining an actual decision is more useful than a broad “AI platform” pitch.

The initial moat is modest. The longer-term opportunity is a trusted workflow: creator-approved context history, reusable formats, moderator habits and interoperable tools. Those are directions to earn, not assets already possessed. Native Twitch features and configurable bots remain serious substitutes.

## Two-week validation plan

**Days 1–3:** interview six qualified creators/moderators. Do not lead with the solution. Ask: “Tell me about the last time someone arrived confused”; “What did you do?”; “How often did this happen last week?”; “What tool or command already handles it?”; “Who would maintain a brief while live?”; “What would make it more work than it saves?” Record consented notes and concrete examples.

**Days 4–10:** run a consented pilot with three creators across at least two streams each. Log setup time, brief-update time, stale actions, proposals reviewed, valid command participants and whether the creator reuses it. Never interpret page opens as unique viewers or claim causal retention effects.

**Days 11–14:** offer a clearly described $12/month pilot after the free trial, without pretending payment infrastructure exists. Ask for a concrete commitment or paid-pilot agreement only once delivery and payment terms are ready.

**Go:** at least three of six interviews describe recurring pain; at least two pilot creators use it on a second stream without prompting; maintaining a brief usually takes under one minute; at least two agree to a $12 paid continuation. **Revise:** creators value context but reject maintenance—reduce steps or target co-hosted streams. **No-go:** fewer than two creators reuse it, no one owns updates, or existing commands solve the job just as well. These thresholds are chosen in advance to avoid calling any activity success.

Before broad paid launch: independently review tenant isolation, backups, deletion controls, abuse limits, Twitch authorization renewal, accessibility and high-load behavior; publish operational and support commitments appropriate to the evidence.
