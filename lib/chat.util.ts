/* The rules for a circle's chat thread (lib/db/chat.ts), shared by the
   composer and the server: how long a message may be, and how long its
   author may still change it. */

export const CHAT_BODY_MAX = 4000;
export const CHAT_MENTIONS_MAX = 20;

// an author may edit for this long; deleting their own has no limit
export const CHAT_EDIT_WINDOW_MS = 15 * 60_000;

// what's wrong with a message's text, or null
export function validateChatBody(body: string): string | null {
  if (!body.trim()) return "Write a message.";
  if (body.length > CHAT_BODY_MAX) return `Keep the message to ${CHAT_BODY_MAX} characters.`;
  return null;
}

export function canEditChat(createdAt: string, now: number): boolean {
  return now - new Date(createdAt).getTime() <= CHAT_EDIT_WINDOW_MS;
}
