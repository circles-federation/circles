import { isPhoneWidth } from "./viewport";

/* Sending a link from the app (an event's, a circle's wiki): the phone's share
   sheet on a phone, and otherwise (desktop browsers included, some of which
   have a share sheet of their own) the link copied. Browser-only: call it
   from a tap. Says which happened, for the caller to say so: closing the
   share sheet isn't a failure, and a browser can refuse the clipboard. */
export async function shareOrCopy(link: { title: string; text?: string; url: string }): Promise<"shared" | "copied" | "failed"> {
  if (isPhoneWidth() && navigator.share) {
    try {
      await navigator.share(link);
    } catch {
      // closing the share sheet isn't a failure
    }
    return "shared";
  }
  try {
    await navigator.clipboard.writeText(link.url);
    return "copied";
  } catch {
    return "failed";
  }
}
