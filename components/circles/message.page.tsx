"use client";

import { useEffect } from "react";
import { ArrowUturnLeftIcon, CheckCircleIcon, InboxArrowDownIcon } from "@heroicons/react/24/outline";
import { Avatar, Button, ButtonLink, Eyebrow, PageContainer, RichSelect } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { rolesHeldBy } from "@/lib/circle-roles.util";
import { fmtDateTime } from "@/lib/format.util";
import { useMemberById } from "@/lib/hooks";
import { messageHtml } from "@/lib/messages.util";
import type { Circle, CircleMessage, Member } from "@/lib/types";
import { Letter } from "./letter";

interface MessagePageProps {
  message: CircleMessage;
  circle: Circle;
  onOpenMember: (m: Member) => void;
}

/* One message to a circle, as a letter (Letter: a sheet of paper with the
   circle's name as its postmark, who it's from and to and when), the
   subject, what they wrote, and their signature. Under
   it, who's handling it (writing back), taken with "I'll handle it" or given
   to any member; Reply by email, which opens the reader's own mail to the
   address the sender agreed to be answered at (there's no replying in the
   app); and Done, which files it away (or Reopen). Opening it marks it read
   for the reader. */
export function MessagePage({ message: m, circle, onOpenMember }: MessagePageProps) {
  const { profile, markMessageRead, assignMessage, setMessageDone } = useAppState();
  const memberById = useMemberById();
  const sender = m.senderId !== undefined ? memberById(m.senderId) : undefined;
  const handler = m.assigneeId !== undefined ? memberById(m.assigneeId) : undefined;
  const circleMembers = circle.members.map(memberById).filter((x): x is Member => Boolean(x));

  useEffect(() => {
    if (!m.read) markMessageRead(m.id);
  }, [m.id, m.read, markMessageRead]);

  const reply = `mailto:${m.replyEmail}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`;

  return (
    <PageContainer size="compact">
      <Letter
        circleName={circle.name}
        from={
          <>
            {sender ? (
              <button type="button" onClick={() => onOpenMember(sender)} className="hit cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-bold text-ink underline underline-offset-2">
                {m.senderName}
              </button>
            ) : (
              <span className="font-bold text-ink">{m.senderName}</span>
            )}
            {sender?.role && <> · {sender.role}</>}
          </>
        }
        to={<span className="font-bold text-ink">{circle.name}</span>}
        date={fmtDateTime(new Date(m.createdAt))}
      >
        <h1 className="mt-5 font-sans text-title leading-[1.05] font-extrabold tracking-display wrap-break-word">{m.subject}</h1>

        {/* HTML made safe by messageHtml: anything typed as HTML is shown as
            text, and only web and mail links are links */}
        <div className="message-text mt-4 font-serif text-lg leading-relaxed text-body wrap-break-word" dangerouslySetInnerHTML={{ __html: messageHtml(m.body) }} />

        <div className="mt-6 flex items-center gap-3">
          {sender ? <Avatar member={sender} size={36} /> : null}
          <span className="font-serif text-xl text-ink italic">{m.senderName}</span>
        </div>
      </Letter>

      {/* who's writing back to them */}
      <section className="mt-8 border-y border-faint py-4">
        <Eyebrow className="text-soft">Handled by</Eyebrow>
        <div className="mt-3 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center">
          <div className="min-w-0 flex-1">
            <RichSelect
              label="Who's handling it"
              placeholder="No one yet"
              value={handler ? String(handler.id) : null}
              onChange={(v) => void assignMessage(m.id, v === "none" ? null : Number(v))}
              options={[
                ...circleMembers.map((x) => ({ value: String(x.id), label: x.id === profile.id ? `${x.name} (you)` : x.name, badges: rolesHeldBy(circle, x.id) })),
                ...(handler ? [{ value: "none", label: "No one", hint: "Put it back for anyone to take" }] : []),
              ]}
            />
          </div>
          {handler?.id !== profile.id && (
            <Button variant="secondary" size="compact" onClick={() => void assignMessage(m.id, profile.id)} className="shrink-0">
              I&rsquo;ll handle it
            </Button>
          )}
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-3 min-[480px]:flex-row">
        <ButtonLink href={reply} className="flex-1">
          <ArrowUturnLeftIcon className="size-4" strokeWidth={2} />
          Reply by email
        </ButtonLink>
        <Button variant="secondary" onClick={() => void setMessageDone(m.id, !m.doneAt)} className="flex-1">
          {m.doneAt ? <InboxArrowDownIcon className="size-4" strokeWidth={2} /> : <CheckCircleIcon className="size-4" strokeWidth={2} />}
          {m.doneAt ? "Reopen" : "Done"}
        </Button>
      </div>
      <p className="mt-3 font-serif text-sm text-soft">
        {m.senderName} agreed to be answered at <span className="text-ink">{m.replyEmail}</span>.
      </p>
    </PageContainer>
  );
}
