import { setTextingByNumber } from "@/lib/db/members";
import { normalizePhone } from "@/lib/phone.util";
import { readSmsWebhook } from "@/lib/sms";

/* The SMS provider's webhook (set as the messaging profile's webhook URL),
   for texts sent to the Circles number and for what became of ours. For now
   only opt-outs mean anything: a STOP or START turns the sender's texts off
   or back on here as soon as the provider has, rather than at the next text
   it refuses, and a text that failed for good turns them off. The provider
   answers the keywords itself, so the reply is always empty. */
export async function POST(request: Request) {
  // the body exactly as sent, since that's what the signature covers
  const event = readSmsWebhook(await request.text(), request.headers);
  if (!event) return new Response("Forbidden", { status: 403 });
  const phone = event.kind === "none" ? null : normalizePhone(event.phone);
  if (event.kind !== "none" && phone) {
    await setTextingByNumber(phone, event.kind === "start" ? "started" : event.kind === "undeliverable" ? "undeliverable" : "stopped");
  }
  return new Response(null, { status: 204 });
}
