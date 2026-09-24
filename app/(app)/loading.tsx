import { PageLoading } from "@/components/shared";

/* With this, a tap on a link switches pages at once: Next shows it inside the
   (app) layout, so TopBar and BottomNav update right away, while it waits on
   the server for the new page, instead of leaving the old page up until the
   response arrives. Next also prefetches it for links on screen. */
export default function Loading() {
  return <PageLoading />;
}
