# Rallypoint: commercial hypotheses

**Initial customer:** a Twitch creator running recurring community challenges, collaborative build sessions, or tabletop campaigns. The creator or a co-host already knows the changing goal and can maintain one short brief.

**Job to be done:** “When someone joins halfway through, help them understand the current moment and take part without making me stop and repeat the setup.”

No interviews, customers, payments, or retention improvements are claimed. This is a validation plan, not evidence of traction.

## Product and pricing

The current product publishes an approved brief, accepts explicit participation commands, reviews community pitches, and shares the current context across a viewer page and OBS overlay. Firebase email/password and guest identities protect private workspaces. Runtime behavior is deterministic, with no transcription or model API calls.

| Offer                | Proposed terms                                                                                             | Status                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Open-source core     | $0 software license price. The operator supplies infrastructure and maintenance.                           | MIT source. Hosting and managed authentication are not promised free.                         |
| Managed creator plan | $12/month for one channel, with managed operation and a dependable creator workflow as the proposed value. | Pricing hypothesis. No paid checkout, subscriptions, or premium entitlements are implemented. |
| Evaluation           | Free access to the public sample and ordinary product testing.                                             | The submitted project must remain accessible throughout judging.                              |

Do not ask a customer to pay for promised team roles or branding features that have not been delivered.

## Operating assumptions

Zero inference spend does not mean zero operating cost. Firebase Hosting, Cloud Run, Firebase Authentication, the named Firestore database, Cloud Tasks, and support have their own allowances and charges. Named databases and shared projects require particular attention to billing eligibility. The backing deployment uses billing-enabled infrastructure.

A useful stress assumption is 100 channels, each streaming 40 hours/month, with an average of 20 open viewer pages during a stream. That is 80,000 page-hours. At an idealized three-second refresh interval, it implies up to 96 million public refresh requests/month, before creator polling, overlays, command processing, retries, and cold starts. The actual sequential client waits for a response before scheduling the next refresh, so latency also changes request volume.

The separate small public snapshot reduces payload size and private-state processing. It does not eliminate Firestore reads. Measure actual reads, writes, CPU, requests, network egress, and support time in pilot streams before setting a margin target or committing to an unlimited plan.

At a proposed $12/month, 100 paying channels would produce $1,200 gross monthly receipts before taxes, refunds, payment processing, infrastructure, and support. This is arithmetic on a hypothetical customer count, not a forecast. No net margin is asserted before measured costs exist.

Primary pricing references: [Firebase](https://firebase.google.com/pricing), [Cloud Run](https://cloud.google.com/run/pricing), and [Firestore](https://cloud.google.com/firestore/pricing). Check the account's actual location, quotas, and billing terms before relying on an allowance.

## Distribution and defensibility

Start with creators who run a recurring shared decision, not every Twitch channel. A real before-and-after clip should show a newcomer understanding the current goal, participating, and seeing the creator use community context responsibly.

Ask permission before contacting creators. Help one creator set up one stream, then observe whether they choose to return on a second stream. A recurring workflow matters more than a one-off enthusiastic reaction.

The initial moat is modest. Native Twitch features and configurable bots remain strong substitutes. Useful advantages must be earned through creator-approved workflows, formats that reduce live maintenance, and dependable integration. The project does not claim a proprietary model or unique access to Twitch data.

## Two-week validation plan

**Days 1 to 3:** interview six qualified creators or co-hosts. Ask about the last confused newcomer, how the creator handled it, the frequency of that problem, existing commands/tools, and who would maintain a current brief. Record concrete examples with consent.

**Days 4 to 10:** pilot with three creators across at least two streams each. Observe setup time, brief-update time, stale invitations, proposals reviewed, explicit participants, and voluntary reuse. Do not interpret page opens as unique people or claim a causal retention result.

**Days 11 to 14:** test willingness to continue at $12/month, with clear delivery and payment terms. A proposed price is not validation; look for a concrete commitment after the product has been used.

**Go:** at least three of six interviews describe recurring pain, at least two pilot creators reuse the product without prompting, routine brief maintenance usually takes under one minute, and at least two agree to a paid continuation.

**Revise:** creators value the context but reject the maintenance burden. Reduce steps or focus on streams with a co-host.

**No-go:** fewer than two creators reuse it, no one owns updates, or existing commands solve the job equally well. Choose these thresholds before interpreting pilot activity.

Before a wider commercial launch, review backup/restore, account deletion, abuse limits, operational monitoring, support commitments, and scale with evidence appropriate to the proposed plan. These are release responsibilities, not traction already achieved.
