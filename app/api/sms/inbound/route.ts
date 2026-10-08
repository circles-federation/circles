import { setTextingByNumber } from "@/lib/db/members";
import { normalizePhone } from "@/lib/phone.util";
import { isFromTwilio, optOutIntent } from "@/lib/sms";

const appUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

/* Twilio's webhook for texts sent to the Circles number (set as the
   Messaging Service's incoming-message URL). For now only STOP and START
   mean anything: they turn the sender's texts off or back on here as soon as
   Twilio has, rather than at the next text it refuses. Twilio answers the
   keywords itself, so the reply is always empty. */
export async function POST(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form) params[key] = typeof value === "string" ? value : "";
  if (!isFromTwilio(`${appUrl}/api/sms/inbound`, params, request.headers.get("x-twilio-signature"))) {
    return new Response("Forbidden", { status: 403 });
  }
  const intent = optOutIntent(params);
  const phone = normalizePhone(params.From ?? "");
  if (intent !== "none" && phone) await setTextingByNumber(phone, intent === "start");
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { "Content-Type": "text/xml" } });
}
