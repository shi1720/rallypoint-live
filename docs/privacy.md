# Privacy and data controls

Rallypoint does not record stream audio or video and does not archive ordinary chat. It processes recognized `!join`, `!vote`, `!pitch`, and `!catchup` commands and incoming raid events.

## Account and private workspace

Firebase Authentication manages email/password and browser-owned guest identities. A fresh verified Firebase token becomes an HTTP-only, SameSite session cookie named `__session`, with a five-day maximum lifetime. Production cookies use Secure. Private requests verify the session and owner on the server. Publicly supplied identity headers do not create an authenticated workspace.

A private workspace retains its published briefs, Twitch user IDs and display names for vote deduplication, selected choices and times, private pitches with their originating chat-message IDs, raid channel names and announced counts, and bounded activity history. OAuth access and refresh tokens are encrypted at rest using AES-GCM with a server-managed key.

The database is server-accessed. Firestore client rules deny direct access. A separate public snapshot contains approved brief text, aggregate participation results, and incoming raid information. It excludes participant identities, private pitches, authorization, and internal cooldown/delivery records.

## Browser storage

The sample scenario stores fictional state in browser localStorage. Its reset control restores the initial example; clearing site storage erases that browser's scenario.

Firebase's browser persistence maintains sign-in state. Guest users should create an email/password account to keep the same workspace across devices. Clearing browser storage or signing out before upgrading can make a guest workspace inaccessible.

A randomly generated browser identifier is stored under `rallypoint.viewer-id` and sent with viewer-open requests. The server combines it with the page and date for approximate daily deduplication. It is not a fingerprint, a unique-person metric, or a retention measure. It can be reset or spoofed, so counts remain approximate.

## Export, reset, and disconnect

Export the session before using **Start new session**. Reset clears the workspace's brief content, contributions, pitches, raids, and activity while retaining its public links and Twitch authorization. Version numbers remain monotonic so delayed commands cannot be mistaken for a later decision. Reset is not a claim of deletion from infrastructure backups or logs.

Disconnect erases locally stored Twitch authorization and attempts remote subscription cleanup and token revocation. If Twitch cleanup cannot be confirmed, revoke access from Twitch Connections. Operational receipts, open-count records, and reply outbox documents are separate from the visible session state and use expiry fields. Cloud Tasks carries only the delivery identifiers required to process committed replies.

Session content has bounded capacity but no automatic calendar-based deletion. Infrastructure retention, TTL configuration, and backup deletion policies are separate operational controls. Separate moderator accounts and granular team roles are not implemented. No payment provider or independent advertising analytics provider is integrated.

This document describes the current implementation. It does not claim a legal compliance certification, independent security certification, or deletion guarantees beyond the implemented controls.
