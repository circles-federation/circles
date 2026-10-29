/* What shows from the first byte of a cold start until the app's data has
   arrived (see app/loading.tsx), so a slow connection never leaves a blank
   screen. The mark is drawn at the middle of the screen at the size of the
   iOS launch images' (scripts/generate-icons.tsx), so the hand-off from the
   system's launch screen to this is seamless. Unlike PageLoading it shows at
   once: on a cold start there's no "usually over before anyone notices". */
export function AppSplash() {
  return (
    <div role="status" aria-label="Loading" className="fixed inset-0 z-40 flex items-center justify-center bg-paper">
      <svg viewBox="0 0 100 100" className="size-24 animate-pulse text-ink" fill="none" stroke="currentColor" strokeWidth="4" aria-hidden>
        <circle cx="50" cy="50" r="28" />
        <circle cx="50" cy="55" r="17" />
        <circle cx="50" cy="61" r="6" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}
