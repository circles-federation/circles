// NEXT_PUBLIC_ is required so Next.js inlines the value into the client
// bundle at build time — AppStateProvider (a client component) has no
// server round-trip to read env vars from otherwise. Value lives in
// .env.local (gitignored) so it isn't committed.
export const FEDERATION_COUNCIL_ENABLED = process.env.NEXT_PUBLIC_FEDERATION_COUNCIL_ENABLED === "true";
