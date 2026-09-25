/* Which build of the app this is: the git commit it was built from, fixed at
   build time by next.config.mjs, so the copy running in a browser and the
   server can tell whether they're the same. Empty if the build couldn't find
   a commit, which turns the check off rather than guessing. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

// whether the server has been deployed since this copy of the app loaded —
// see AppStateProvider's refresh. Any failure to find out counts as no.
export async function isOutdatedVersion(): Promise<boolean> {
  if (!APP_VERSION) return false;
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return false;
    const { version } = (await res.json()) as { version?: string };
    return !!version && version !== APP_VERSION;
  } catch {
    return false;
  }
}
