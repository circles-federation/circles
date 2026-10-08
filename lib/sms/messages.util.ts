/* The app's texts, as pure functions from data to a message body — the
   counterparts of lib/email/templates.util.ts and lib/push/messages.util.ts.
   Short: a text over 160 plain characters is billed as several. */

// confirming a number is theirs, when applying or adding it in Settings
export function phoneCodeText(code: string, minutes: number): string {
  return `Your Circles code is ${code}. It expires in ${minutes} minutes. Reply STOP to opt out.`;
}
