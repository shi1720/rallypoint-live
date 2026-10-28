# Verification report

Observed on October 28, 2026. This report separates development verification from real Twitch proof.

| Layer                       | Observed result                    | What it establishes                                                                                                                                                                                                                    |
| --------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine and security         | **59 passed, 0 failed**            | Versioned state, expiry/close, moderation boundaries, cooldowns, event-time ordering, privacy, bounded response size, AES-GCM/HMAC, payload limits, owner-scoped webhook routing and error handling                                    |
| Actual local HTTP + D1      | **15 passed**                      | Anonymous studio denial, same-origin writes, forbidden synthetic events, input rejection, concurrent stale publish conflict, public projection, export, close, real Worker signature ingress, replay protection and signed raid timing |
| TypeScript                  | **Passed**                         | Full project `tsc --noEmit`, including API handlers, UI and tests                                                                                                                                                                      |
| Production build            | **Passed**                         | Vinext/Cloudflare Worker and client bundles compile with all routes                                                                                                                                                                    |
| Fresh local migrations      | **Passed twice**                   | Both migrations apply to an empty isolated D1 database; second run correctly reports no migrations pending                                                                                                                             |
| Browser, desktop            | **Reviewed**                       | Landing/rehearsal, simulated raid/newcomer, queue rejection/acceptance, explicit publish, cross-tab viewer synchronization, close, local sign-in gate                                                                                  |
| Browser, narrow viewer page | **Reviewed at 390px**              | Readable phone-width public page without visible horizontal clipping                                                                                                                                                                   |
| Pitch and PDF               | **Rendered and visually reviewed** | Six editable slides and four PDF pages checked for visible clipping/overlap                                                                                                                                                            |
| Real Twitch OAuth / chat    | **Not yet verified**               | Needs broadcaster sign-in, app credentials and publicly reachable callback                                                                                                                                                             |
| Actual OBS capture          | **Not yet verified**               | Browser overlay route implemented; must test in OBS with real Twitch footage                                                                                                                                                           |
| Public judging access       | **Not yet verified**               | Initial hosted Site is owner-private; must enable public access and check signed out before submission                                                                                                                                 |

## Dependency audit

The inherited starter initially produced six production dependency findings, including critical advisories. Updated Next to 16.4.3, Zod to 4.6.7, sharp to 0.35.5 and affected transitive packages. A fresh clean install and `npm audit --omit=dev` now report zero known production dependency vulnerabilities. This registry check is time-specific and does not certify the application. All 59 tests and full TypeScript checks were rerun after the updates. CI repeats the production audit.

## Deployed checkpoint

Version 1 was published successfully from commit `b472d5b336d9e6f3fa176b8853729485d056f127`. A production service health check returned 200 and unauthenticated studio API access returned 401. GitHub CI passed: https://github.com/shi1720/rallypoint-live/actions/runs/40670486611 . Public access and real Twitch authorization remain pending.

## Reproduce

`npm test`, `npm run typecheck`, `npm run build`. For HTTP checks, run the migrated local dev server with the disposable test secret in `.dev.vars.example`, then `npm run test:http`. The HTTP suite refuses non-loopback URLs. Its fake Twitch events do not contact Twitch and must not be described as live traffic.

The 59-test suite includes actual webhook-handler execution with mocked database/provider boundaries and cryptographically valid signatures. The separate HTTP test traverses the running Worker and local D1. Neither tests an external Twitch account, public webhook delivery, a production authentication gateway, billing behavior or large-channel load. There is no asserted security certification, uptime target, production scale benchmark, paid customer or retention lift.

## Browser evidence

The screenshots in `docs/images` show actual rendered application pages. They display explicit rehearsal labels. They are suitable for the gallery when labeled as rehearsal, and are not substitutes for the required real Twitch demonstration.

## Release gate

Before final Devpost submission, verify real OAuth and enabled subscriptions, type real commands in the authorized channel, observe the public page and actual OBS source, confirm close/expiry, upload a public video under three minutes, and check anonymous judging access. Preserve free judging access through the judging period. See checklist and the verbatim script.
