// Compatibility entrypoint. The current HTTP suite tests native Firebase authentication,
// Next.js, Firestore transactions and signed fixtures instead of the removed D1 preview.
await import("./deployed-e2e.mjs");
