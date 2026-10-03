"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import { CheckCircleIcon, CheckIcon, HandRaisedIcon, HandThumbDownIcon, HandThumbUpIcon, XCircleIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { MutationResult } from "@/components/providers/app-state-provider";
import { Button, Chip, Eyebrow, EyebrowGroup, PageContainer, Section, SectionGroup, TextArea, useToast } from "@/components/shared";
import { fmtDateTime } from "@/lib/format.util";
import { useMemberById } from "@/lib/hooks";
import { OBJECTION_REASON_MAX, RESPONSE_LABEL, proposalTitle, responseOf } from "@/lib/proposals.util";
import type { Circle, CircleProposal, ConsentResponse, Member } from "@/lib/types";

interface ProposalPageProps {
  proposal: CircleProposal;
  circle: Circle;
  memberId: number;
  onOpenCircle: () => void;
  onOpenMember: (m: Member) => void;
  onRespond: (response: ConsentResponse, reason?: string) => Promise<MutationResult>;
}

// each answer's look: green, thumb up, likes it; yellow, a check, accepts it
// (both consent); red, thumb down, objects
const ANSWER_STYLE: Record<ConsentResponse, { button: string; dot: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  like: { button: "border-leaf bg-leaf text-paper", dot: "bg-leaf", icon: HandThumbUpIcon },
  accept: { button: "border-accept bg-accept text-ink", dot: "bg-accept", icon: CheckIcon },
  object: { button: "border-danger bg-danger text-paper", dot: "bg-danger", icon: HandThumbDownIcon },
};

/* A proposed change to a circle, for its members to answer by consent (see
   lib/proposals.util.ts): what it changes, before and after; until when it's
   open, or how it ended; three buttons, green, yellow and red, the red one
   asking why; and where every member stands, as a sociocratic round shows
   everyone's answer. Reached from its email or push, the circle's banner,
   and Home. */
export function ProposalPage({ proposal: p, circle, memberId, onOpenCircle, onOpenMember, onRespond }: ProposalPageProps) {
  const memberById = useMemberById();
  const { showToast } = useToast();
  const proposer = memberById(p.proposerId);
  const mine = responseOf(p, memberId);
  const open = p.status === "open";
  const canAnswer = open && p.proposerId !== memberId;
  const [objecting, setObjecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objection = p.responses.find((r) => r.response === "object");
  const objector = objection ? memberById(objection.memberId) : undefined;

  async function answer(response: ConsentResponse) {
    setBusy(true);
    setError(null);
    const result = await onRespond(response, response === "object" ? reason : undefined);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setObjecting(false);
    showToast({ tone: "success", message: response === "object" ? "Your objection is in. Everyone's been told." : "Your answer is in." });
  }

  return (
    <PageContainer size="normal">
      <div className="border-t-[3px] border-t-ink border-b border-b-ink pt-4 pb-5">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow className="text-soft">Proposal</Eyebrow>
          <Chip onClick={onOpenCircle}>{circle.name}</Chip>
        </div>
        <h1 className="mt-3 font-sans text-title leading-[0.95] font-extrabold tracking-[-0.035em]">{proposalTitle(p)}</h1>
        <p className="mt-3 font-serif text-sm text-soft">
          Proposed by{" "}
          {proposer ? (
            <button type="button" onClick={() => onOpenMember(proposer)} className="cursor-pointer border-0 bg-transparent p-0 font-serif text-sm text-soft underline underline-offset-2">
              {proposer.name}
            </button>
          ) : (
            "a former member"
          )}{" "}
          on {fmtDateTime(new Date(p.createdAt))}
        </p>
      </div>

      <Outcome proposal={p} objectorName={objector?.name} />

      <SectionGroup>
        <Section>
          <EyebrowGroup label="What it changes">
            <div className="border-t border-ink">
              {p.lines.map((l) => (
                <div key={l.label} className="border-b border-faint py-3 last:border-b-ink">
                  <Eyebrow className="text-soft">{l.label}</Eyebrow>
                  {l.after && <div className="mt-1 font-serif text-lg leading-snug">{l.after}</div>}
                  {l.before && <div className="mt-0.5 font-serif text-base leading-snug text-soft line-through">{l.before}</div>}
                </div>
              ))}
            </div>
          </EyebrowGroup>
        </Section>

        {open && (
          <Section>
            <EyebrowGroup label="Your answer">
              {!canAnswer ? (
                <p className="font-serif text-base text-soft">You proposed this, so you&rsquo;ve consented.</p>
              ) : (
                <>
                  {mine && <p className="mb-3 font-serif text-base">You answered: <strong className="font-sans">{RESPONSE_LABEL[mine.response]}</strong>. You can change it until it closes.</p>}
                  <div className="grid grid-cols-1 gap-2.5 min-[720px]:grid-cols-3">
                    {(["like", "accept", "object"] as const).map((r) => {
                      const Icon = ANSWER_STYLE[r].icon;
                      // the black outline is only ever your answer as it stands; red
                      // goes hollow while an objection is being written, until it's sent
                      const chosen = mine?.response === r;
                      const drafting = r === "object" && objecting;
                      return (
                      <button
                        key={r}
                        type="button"
                        disabled={busy}
                        onClick={() => (r === "object" ? setObjecting((o) => !o) : answer(r))}
                        aria-pressed={r === "object" ? undefined : chosen}
                        aria-expanded={r === "object" ? objecting : undefined}
                        className={clsx(
                          "inline-flex cursor-pointer items-center justify-center gap-2 border-2 px-4 py-3.5 font-sans text-sm font-extrabold tracking-[0.02em] active:brightness-90 disabled:cursor-default disabled:opacity-60",
                          drafting ? "border-danger bg-paper text-danger" : ANSWER_STYLE[r].button,
                          chosen && "outline-3 outline-offset-2 outline-ink"
                        )}
                      >
                        <Icon className="size-5 shrink-0" strokeWidth={2} aria-hidden />
                        {RESPONSE_LABEL[r]}
                      </button>
                      );
                    })}
                  </div>
                  {objecting && (
                    <div className="mt-4 border-l-4 border-danger pl-4">
                      <label htmlFor="objection" className="block font-sans text-sm font-extrabold">
                        Why do you object?
                      </label>
                      <p className="mt-1 font-serif text-sm leading-snug text-soft">
                        An objection stops the proposal. Say what would need to change for you to consent.
                      </p>
                      <TextArea id="objection" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={OBJECTION_REASON_MAX} rows={3} className="mt-2.5" />
                      <div className="mt-3 flex gap-2.5">
                        <Button variant="danger" disabled={busy || !reason.trim()} onClick={() => answer("object")}>
                          Object
                        </Button>
                        <Button variant="secondary" disabled={busy} onClick={() => setObjecting(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {error && <p className="mt-3 font-sans text-sm font-bold text-danger">{error}</p>}
                </>
              )}
            </EyebrowGroup>
          </Section>
        )}

        <Section>
          <EyebrowGroup label="Answers">
            <div className="border-t border-ink">
              {circle.members
                .map((id) => memberById(id))
                .filter((m): m is Member => !!m)
                .map((m) => {
                  const r = responseOf(p, m.id);
                  return (
                    <div key={m.id} className="border-b border-faint py-3 last:border-b-ink">
                      <div className="flex items-center justify-between gap-3">
                        <button type="button" onClick={() => onOpenMember(m)} className="cursor-pointer border-0 bg-transparent p-0 text-left font-sans text-base font-bold text-ink">
                          {m.name}
                        </button>
                        <span className="flex shrink-0 items-center gap-2 font-sans text-sm text-soft">
                          <span aria-hidden className={clsx("size-2.5 rounded-full", r ? ANSWER_STYLE[r.response].dot : "border border-soft")} />
                          {r ? RESPONSE_LABEL[r.response] : open ? "No answer yet" : "Didn't answer"}
                        </span>
                      </div>
                      {r?.reason && <p className="mt-1.5 font-serif text-sm leading-snug italic text-[#222]">&ldquo;{r.reason}&rdquo;</p>}
                    </div>
                  );
                })}
            </div>
          </EyebrowGroup>
        </Section>
      </SectionGroup>
    </PageContainer>
  );
}

// until when it's open and what happens then, or how it ended
function Outcome({ proposal: p, objectorName }: { proposal: CircleProposal; objectorName?: string }) {
  const [Icon, tone, heading, text] =
    p.status === "open"
      ? [HandRaisedIcon, "border-l-ink", `Open until ${fmtDateTime(new Date(p.closesAt))}`, "If no one objects by then, it's made. It's made sooner if everyone consents."]
      : p.status === "passed"
        ? [CheckCircleIcon, "border-l-leaf", "Passed", `No one objected, so the change was made${p.decidedAt ? ` on ${fmtDateTime(new Date(p.decidedAt))}` : ""}.`]
        : [XCircleIcon, "border-l-danger", "Objected", `${objectorName ?? "A member"} objected, so it won't be made. It can be proposed again, changed to meet the objection.`];
  return (
    <div role="status" className={clsx("mt-6 flex items-start gap-3 border border-ink border-l-4 px-4.5 py-4", tone)}>
      <Icon className="mt-px size-5 shrink-0" strokeWidth={2} />
      <div>
        <div className="font-sans text-sm font-extrabold tracking-[0.02em]">{heading}</div>
        <p className="mt-1.5 font-serif text-sm leading-relaxed text-[#222]">{text}</p>
      </div>
    </div>
  );
}
