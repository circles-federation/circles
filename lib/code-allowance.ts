import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { takeCodeAllowance } from "@/lib/db/guest-rsvps";

/* Count a request for an emailed code from a public form (a guest's RSVP,
   or their message to a circle) against its connection's hourly allowance
   (see takeCodeAllowance), shared by every such form. Keyed by a hash of the
   IP address the proxy reports, so the address itself isn't kept. With none
   to go by (local development) there's nothing to limit by. Kept out of the
   "use server" files, which may only export actions. */
export async function takeAllowance(): Promise<void> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) await takeCodeAllowance(createHash("sha256").update(`${ip}|${process.env.BETTER_AUTH_SECRET ?? ""}`).digest("hex"));
}
