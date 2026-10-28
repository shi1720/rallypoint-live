# Privacy and data controls

Rallypoint does not record stream audio/video and does not archive ordinary chat. It processes the recognized commands `!join`, `!vote`, `!pitch`, `!catchup` and incoming raid events.

The authenticated studio retains Twitch user IDs and display names for vote deduplication, the selected choice and time, pitches with their originating chat-message ID, raid channel and viewer count, published briefs and bounded activity history. Tokens are encrypted with AES-256-GCM using a server-managed key. Twitch user names, IDs, private pitches, OAuth data, cooldowns and replay receipts never appear in the public API. The published brief, aggregate participation results and raiding channel are public wherever the approved brief is shared.

Use Export before Reset session to retain a copy. Reset replaces the studio's session state. Disconnect erases locally stored Twitch authorization and chat outbox rows and attempts to revoke authorization and remove remote subscriptions. You can also revoke access through Twitch's Connections settings. Hosted infrastructure may retain backups/logs under its own policies; this application does not promise deletion from those systems. No payment or independent analytics provider is integrated.

The public viewer page sets one first-party HTTP-only SameSite cookie per brief link for a day to limit repeated open counts. Opens are approximate browser activity, not unique people or retention. Rehearsal data stays in browser localStorage and contains fictional people/events. Reset scenario restores the demo. Clear site storage to erase it entirely.

Sessions have bounded capacity and do not automatically delete their vote/pitch history on a calendar schedule. Export and reset between streams, especially before sharing access to the creator's device. Event receipts/outbox records are operational metadata and are separate from the visible session export. They contain delivery IDs and owner IDs, and outbox text may contain the approved brief. Separate moderator accounts and granular team access are not implemented.

This document describes implemented behavior and is not a legal compliance certification. Before a wider commercial launch, establish a suitable retention policy, user-account deletion process, creator terms, abuse controls and infrastructure backup/deletion policy with qualified review.
