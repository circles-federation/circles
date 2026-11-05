import { Marked } from "marked";
import { MONTHS, fmtTime } from "./format.util";

/* The rules for a message written to a circle (its Inbox, lib/db/
   messages.ts), shared by the form, the server and the emails: how long it
   may be, and how its Markdown becomes something to read. */

export const MESSAGE_SUBJECT_MAX = 120;
export const MESSAGE_BODY_MAX = 5000;

export interface MessageInput {
  subject: string;
  // Markdown, as the editor writes it
  body: string;
  // the sender agrees to be replied to at their email address
  consent: boolean;
}

// what's wrong with a message, for the form as it's written and the server
// as the real check, or null
export function validateMessage(input: MessageInput): string | null {
  const subject = input.subject.trim();
  const text = messageText(input.body);
  if (!subject) return "Give your message a subject.";
  if (subject.length > MESSAGE_SUBJECT_MAX) return `Keep the subject to ${MESSAGE_SUBJECT_MAX} characters.`;
  if (!text) return "Write a message.";
  if (input.body.length > MESSAGE_BODY_MAX) return `Keep the message to ${MESSAGE_BODY_MAX} characters.`;
  if (!input.consent) return "Agree to be replied to by email, so they can answer you.";
  return null;
}

/* The message as plain text, its Markdown taken out: a line of it in the
   Inbox's list, a push's preview, and the plain part of an email. Links keep
   their address after their words. */
export function messageText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1 ($2)")
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/(\*\*|__|\*|_|~~|`)/g, "")
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// a link is only one of these: anything else (javascript:, data:) is shown
// as its words alone
const SAFE_LINK = /^(https?:|mailto:)/i;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* The message's Markdown as HTML to read, in the app and in the email: what
   the editor can write (paragraphs, bold, italic, lists, links, line breaks)
   and nothing a sender could use against a reader. Any HTML typed into it is
   shown as text, never run, and only web and mail links become links,
   opening in a new tab. One renderer for both, so a message reads the same
   wherever it's opened. */
const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html: ({ text }) => escapeHtml(text),
    link(token) {
      const words = this.parser.parseInline(token.tokens);
      return SAFE_LINK.test(token.href) ? `<a href="${escapeHtml(token.href)}" target="_blank" rel="noopener noreferrer nofollow">${words}</a>` : words;
    },
    image: ({ text }) => escapeHtml(text),
  },
});

export function messageHtml(markdown: string): string {
  return marked.parse(markdown, { async: false });
}

// when it came, as a list shows it: the time today, "Yesterday", then the
// day ("Oct 20"), with the year once it's another year's
export function messageWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const dayOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((dayOf(now) - dayOf(d)) / 86_400_000);
  if (days === 0) return fmtTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  if (days === 1) return "Yesterday";
  const day = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? day : `${day}, ${d.getFullYear()}`;
}
