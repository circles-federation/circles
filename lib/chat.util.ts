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

export interface MentionTarget {
  id: number;
  name: string;
}

/* The @word being typed at the caret: from its @ (at the start or after a
   space) up to the caret, with no space in it yet. Null when the caret isn't
   in one. */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const found = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  return found ? { start: caret - (found[2] ?? "").length - 1, query: found[2] ?? "" } : null;
}

// who a typed @query could mean: names with a word that starts with it, the
// ones that start with it themselves first
export function matchMentions<T extends { name: string }>(people: T[], query: string, limit = 6): T[] {
  const q = query.toLowerCase();
  const starts = (name: string) => name.toLowerCase().startsWith(q);
  return people
    .filter((p) => !q || p.name.toLowerCase().split(/\s+/).some((word) => word.startsWith(q)))
    .sort((a, b) => Number(starts(b.name)) - Number(starts(a.name)) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// those picked from the list whose @name is still in what's being sent: deleting
// the name takes the mention back
export function mentionsIn(text: string, picked: MentionTarget[]): number[] {
  return [...new Set(picked.filter((p) => text.includes(`@${p.name}`)).map((p) => p.id))];
}

/* A message's rendered HTML (lib/messages.util.ts) with the @names it was
   addressed to picked out. Only text is touched, never a tag's attributes. */
export function highlightMentions(html: string, names: string[]): string {
  if (names.length === 0) return html;
  const escaped = names
    .map((n) => n.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "(?:'|&#39;)"))
    .sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`@(?:${escaped.join("|")})(?![\\p{L}\\p{N}])`, "gu");
  return html
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith("<") ? part : part.replace(pattern, (m) => `<span class="chat-mention">${m}</span>`)))
    .join("");
}
