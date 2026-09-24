/* What a page shows while Next waits on the server during navigation (see
   app/(app)/loading.tsx): nothing, at first. Every page renders from
   AppStateProvider's data, so the wait is only a network round trip and
   usually over well before anyone would notice; a spinner fades in only if
   it isn't (see --animate-fade-in-late in app/globals.css). Fixed to the
   middle of the screen rather than the page, so it's centred the same
   whether the document or the installed app's <main> is what scrolls. */
export function PageLoading() {
  return (
    <div role="status" aria-label="Loading" className="pointer-events-none fixed inset-0 flex animate-fade-in-late items-center justify-center">
      <div className="size-7 animate-spin rounded-full border-2 border-faint border-t-soft" />
    </div>
  );
}
