# Final independent judging and release review

Review date: October 28, 2026. This assessment follows genuine Twitch authorization and chat testing on the Firebase release. Scores are private review heuristics, not an award prediction.

## Evidence and its limits

The release coordinator reports **112 local tests passed**, **41 hosted checks passed**, successful lint, TypeScript, production build, and a zero-vulnerability production dependency audit. GitHub CI passed for source `06e50056ac2ff8b384348e4bc024d3e08999ed0c`: [CI run](https://github.com/shi1720/rallypoint-live/actions/runs/40695556107). Cloud Run revision `rallypoint-00008-mwh` serves that application source through https://rallypoint-desk.web.app. The later commits inspected in this review contain documentation changes; the inspected application source matches `06e5005`.

These release results are coordinator-reported evidence. This final review did not rerun the suites, operate a browser, or mutate Twitch state. It independently inspected the supplied release artifacts, including:

- `twitch-connected.png`, `twitch-catchup-reply.png`, `twitch-vote-replaced.png`, `twitch-private-pitch.png`, `twitch-live-viewer.png`, and `twitch-closed-refusal.png` in `outputs/qa`.
- Sanitized subscription, reply-outbox, and public-state records in `work/live-proof`. The subscription record shows both real subscription types enabled. The outbox record shows the V2 reply sent. Public records support the vote, moderation, and closed-chapter checks below.

The artifacts support the observed behavior. They do not establish independent customer adoption, load capacity, a genuine incoming raid, or native OBS operation. The hosted fixture suite and genuine Twitch test are distinct evidence layers. See [verification](verification.md) for the maintained release record.

## Genuine Twitch proof

| Workflow | Observed evidence |
| --- | --- |
| Broadcaster authorization | The coordinator completed OAuth as `shi1720`; the real desk shows the connected channel. Both `channel.chat.message` and `channel.raid` subscriptions are enabled. |
| Catchup reply | A real `!catchup` produced a visible threaded Twitch reply matching published brief V2. Its outbox status is `sent`. |
| Participation | Real `!join A` produced one contributor and A1/B0 in the desk and public projection. `!join B` changed that same contributor to A0/B1 without increasing the total. |
| Editorial control | The labeled test pitch appeared privately. It remained absent from the public API. Acceptance alone left public V2 unchanged. Explicit editing and publication created V3 with fresh decision counts. |
| Finished chapter | After V3 closed, a real `!join A` received the threaded response, “There is no active participation brief right now.” The inspected public record is V3, closed, with zero current contributors. |

The tested chat commands were self-authored through the authorized account. They prove the integration and workflow, not an independent viewer or customer cohort. An enabled raid subscription proves registration; a genuine raid event remains unverified. The browser overlay preview is separate from the still-unverified native OBS Browser Source.

## Rubric scores

| Criterion | Score / 10 | Assessment |
| --- | ---: | --- |
| Innovation / idea | **7** | Approved context, one current action, private suggestions, and an explicit end form a coherent participation handoff. The workflow is more focused than a general summary bot. Polls, context commands, overlays, and automation remain strong substitutes, so the distinctive value needs a clear completed story. |
| Potential impact | **6.5** | A newcomer joining a shared challenge is a relatable problem. The real flow now works on Twitch. Creator maintenance, repeat use, willingness to pay, and newcomer comprehension still need evidence from people beyond the builder's test account. |
| Technological implementation | **8.5** | Genuine OAuth, enabled subscriptions, a confirmed chat reply, vote replacement, private moderation, explicit publication, and closed-chapter refusal now support the core integration. The implementation also has verified identities, owner isolation, transactional receipts/outbox, compressed storage, guarded versions, and atomic authorization pausing. Scale, real raids, and native OBS remain practical limits on broader claims. |
| Design | **8** | The inspected real desk and viewer have a coherent identity, readable hierarchy, clear commands, and understandable editorial boundaries. Templates, empty states, privacy explanations, account warnings, and freshness behavior support usability. The wide chat capture needs tighter framing to remain readable in a short video. |
| **Total** | **30 / 40** | **7.5 / 10 average. The strongest remaining gains are presentation, ownership continuity, and evidence of repeated real use.** |

## Remaining priorities

### Preserve the connected workspace

The inspected real workspace is labeled as a browser-owned guest workspace. Preserve its Firebase UID and upgrade it before sign-out or browser-storage cleanup. Losing that guest identity can strand the linked channel until operator recovery. The handoff should make the ownership and recovery path clear.

### Reconcile the final submission materials

Update every remaining pending-OAuth or unverified-chat statement to match the proof matrix above. Keep the release revision, test counts, application URL, public video, captions, and Devpost fields consistent. V2 media was being assembled at this review checkpoint; this review does not claim its final upload or playback has been verified.

Put the genuine catchup reply and A-to-B vote replacement early in the video. Crop the empty chat area so the actual message and response are legible. Explain the self-authored integration-test pitch accurately. Keep simulated raids continuously labeled and do not imply native OBS footage or independent community adoption.

### Validate the commercial workflow

The proposed $12/month plan remains a pricing experiment. No completed interviews, repeat-use pilots, customers, revenue, or retention lift are established. Follow the existing six-interview and three-pilot plan. Measure setup time, normal update effort, voluntary reuse on another stream, and whether newcomers understand the next action without explanation. Maintaining accurate context during a stream remains the principal adoption risk.

The moat is currently modest. Defensibility must come from a dependable creator workflow, low maintenance, distribution, and repeated use. Adding model calls or more broad features would not establish those advantages.

### Measure scale and operational cost before a paid rollout

Three-second viewer polling still consumes infrastructure reads and requests. New browser identifiers can also generate writes; same-origin checks do not prevent a custom automated client from supplying an Origin header. Measure abuse, room contention, infrastructure usage, and support effort before promising a large audience or unlimited plan.

The business plan's illustrative 100-channel scenario implies up to 96 million public refresh requests per month. The small public snapshot reduces payload and private processing, but it does not eliminate reads. Zero inference spend does not establish a profitable managed service. Account deletion, backup/restore exercises, incident visibility, support ownership, and demonstrated large-channel capacity remain commercial launch work.

## Release assessment

The genuine test now establishes the core Twitch integration and the intended editorial workflow. Complete the final media and submission reconciliation, preserve owner access, and retain the explicit real-raid and native-OBS limits. Further judging confidence should come from a readable, truthful demonstration and creator reuse. No new broad feature expansion is justified by this review.
