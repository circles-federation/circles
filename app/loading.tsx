import { AppSplash } from "@/components/shared";

/* The root boundary: on a cold start the (app) layout waits on the session and
   the database before it can render anything, and its own loading.tsx sits
   inside it, so without this nothing is sent until that's done. With it, the
   root layout's shell and this splash stream at once. Navigating inside the
   app still uses app/(app)/loading.tsx, the nearer boundary. */
export default function Loading() {
  return <AppSplash />;
}
