"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import { CheckCircleIcon, CheckIcon, HandRaisedIcon, HandThumbDownIcon, HandThumbUpIcon, XCircleIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { MutationResult } from "@/components/providers/app-state-provider";
import { Button, ConfirmModal, Eyebrow, EyebrowGroup, CappedChip, PageContainer, TextArea, useToast, BOXED_LIST } from "@/components/shared";
import { fmtDateTime } from "@/lib/format.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import { answerIsStale, pendingFederationCircles } from "@/lib/federation.util";
import { FederationDeciderName, FederationDeciderStatus } from "./federation-deciders";
import { OBJECTION_REASON_MAX, RESPONSE_LABEL, isEventProposal, proposalTitle, responseOf } from "@/lib/proposals.util";
import type { Circle, CircleProposal, ConsentResponse, Member } from "@/lib/types";

interface ProposalPageProps {
  proposal: CircleProposal;
  circle: Circle;
  // everyone with a say in it, whose answers are listed: its circle's members,
  // and the members of a circle its neighborhood decides about
  deciders: number[];
  // why these people decide it, where that isn't just its circle: a post, a
  // new Circle, or a change its neighborhood decides too
  explainer?: string;
  // a new Circle that was started: its page
  onOpenStarted?: () => void;
  // a proposal to remove a chat message: the circle's chat
  onOpenChat?: () => void;
  memberId: number;
  onOpenCircle: () => void;
  onOpenMember: (m: Member) => void;
  onRespond: (response: ConsentResponse, reason?: string) => Promise<MutationResult>;
  // an event proposal: its event's page; and withdrawing it while it's open
  // (an event's or a post's by any member, a change's or a new Circle's by its
  // proposer)
  onOpenEvent?: () => void;
  // an event proposal where consenting is also an RSVP (one without signup roles)
  consentIsRsvp?: boolean;
  onWithdraw?: () => Promise<MutationResult>;
  // a federation proposal's delegates
  onNominate?: (circleId: string, memberId: number) => Promise<MutationResult>;
  onObjectToNominee?: (circleId: string, reason: string) => Promise<MutationResult>;
}

// each answer's look: green, thumb up, likes it; yellow, a check, accepts it
// (both consent); red, thumb down, objects
const ANSWER_STYLE: Record<ConsentResponse, { button: string; dot: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  like: { button: "ink-press border-ink bg-tint-leaf text-on-action", dot: "bg-leaf", icon: HandThumbUpIcon },
  accept: { button: "ink-press border-ink bg-tint-warn text-on-action", dot: "bg-accept", icon: CheckIcon },
  object: { button: "danger-press border-danger bg-paper text-danger", dot: "bg-danger", icon: HandThumbDownIcon },
};

/* A proposed change to a circle, for its members to answer by consent (see
   lib/proposals.util.ts): what it changes, before and after; until when it's
   open, or how it ended; three buttons, green, yellow and red, the red one
   asking why; and where every member stands, as a sociocratic round shows
   everyone's answer. Reached from its email or push, the circle's banner,
   and Home. */
// what each kind is about, as its section heads it
const ABOUT: Record<CircleProposal["kind"], string> = { change: "What it changes", event: "The event", post: "The post", new_circle: "The circle", remove_message: "The message", coordinating_circle: "The federation" };

export function ProposalPage({ proposal: p, circle, deciders, explainer, onOpenStarted, onOpenChat, memberId, onOpenCircle, onOpenMember, onRespond, onOpenEvent, consentIsRsvp = false, onWithdraw, onNominate, onObjectToNominee }: ProposalPageProps) {
  // it proposes holding an event, not changing the circle
  const event = isEventProposal(p);
  const [withdrawing, setWithdrawing] = useState(false);
  // shown under the Withdraw button, which the proposer (who has no answer
  // section) is the most likely to use
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const memberById = useMemberById();
  const { showToast } = useToast();
  const proposer = memberById(p.proposerId);
  const mine = responseOf(p, memberId);
  const open = p.status === "open";
  const byId = useCirclesById();
  // a federation is answered by circle: once yours has consented, you're done,
  // and a delegate named after you answered asks you again
  const federation = p.kind === "coordinating_circle";
  const canAnswer = open && p.proposerId !== memberId && (!federation || pendingFederationCircles(p, memberId, byId).length > 0);
  const stale = federation && canAnswer && answerIsStale(p, memberId, byId);
  // the answer being weighed, before it's confirmed: every answer is asked to be
  // confirmed, an objection with its reason
  const [choice, setChoice] = useState<ConsentResponse | null>(null);
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
    setChoice(null);
    showToast({ tone: "success", message: response === "object" ? "Your objection is in. Everyone's been told." : "Your answer is in." });
  }

  // each of these members and where they stand
  const answers = (ids: number[]) => (
    <div className={BOXED_LIST}>
      {ids
        .map((id) => memberById(id))
        .filter((m): m is Member => !!m)
        .map((m) => {
          const r = responseOf(p, m.id);
          return (
            <div key={m.id} className="border-b border-ink py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => onOpenMember(m)} className="hit cursor-pointer border-0 bg-transparent p-0 text-left font-sans text-base font-bold text-ink">
                  {m.name}
                </button>
                <span className="flex shrink-0 items-center gap-2 font-sans text-sm text-soft">
                  <span aria-hidden className={clsx("size-2.5 rounded-full", r ? ANSWER_STYLE[r.response].dot : "border border-soft")} />
                  {r ? RESPONSE_LABEL[r.response] : open ? "No answer yet" : "Didn't answer"}
                </span>
              </div>
              {r?.reason && <p className="mt-1.5 font-serif text-sm leading-snug italic text-body">&ldquo;{r.reason}&rdquo;</p>}
            </div>
          );
        })}
    </div>
  );

  return (
    <PageContainer size="wide">
      <div className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow className="text-soft">Proposal</Eyebrow>
          <CappedChip onClick={onOpenCircle}>{circle.name}</CappedChip>
        </div>
        <h1 className="mt-3 font-sans text-title leading-[0.95] font-extrabold tracking-display min-[960px]:text-[56px]">{proposalTitle(p)}</h1>
        <p className="mt-3 font-serif text-sm text-soft">
          Proposed by{" "}
          {proposer ? (
            <button type="button" onClick={() => onOpenMember(proposer)} className="hit cursor-pointer border-0 bg-transparent p-0 font-serif text-sm text-soft underline underline-offset-2">
              {proposer.name}
            </button>
          ) : (
            "a former member"
          )}{" "}
          on {fmtDateTime(new Date(p.createdAt))}
        </p>
        {explainer && <p className="mt-2 font-serif text-sm leading-snug text-soft">{explainer}</p>}
      </div>

      <Outcome proposal={p} objectorName={objector?.name} />

      {/* two columns from 960px: the change and everyone's answers on the
          left, yours on the right. On a phone one run, in the order the
          sections come (`order` over `contents` columns), apart by space */}
      <div className="mt-8 flex flex-col gap-10 min-[960px]:grid min-[960px]:grid-cols-2 min-[960px]:items-start min-[960px]:gap-x-12">
        <div className="contents min-[960px]:flex min-[960px]:flex-col min-[960px]:gap-10">
        <section className="order-1">
          <EyebrowGroup label={ABOUT[p.kind]}>
            <div className={BOXED_LIST}>
              {p.lines.map((l) => (
                <div key={l.label} className="border-b border-ink py-4 last:border-b-0">
                  <Eyebrow className="text-soft">{l.label}</Eyebrow>
                  {l.after && <div className="mt-1 font-serif text-lg leading-snug whitespace-pre-line">{l.after}</div>}
                  {l.before && <div className="mt-0.5 font-serif text-base leading-snug text-soft line-through">{l.before}</div>}
                </div>
              ))}
            </div>
            {onOpenEvent && (
              <button type="button" onClick={onOpenEvent} className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-bold text-ink underline underline-offset-2">
                See the event&rsquo;s page
              </button>
            )}
            {onOpenChat && (
              <button type="button" onClick={onOpenChat} className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-bold text-ink underline underline-offset-2">
                Go to {circle.name}&rsquo;s chat
              </button>
            )}
            {onOpenStarted && (
              <button type="button" onClick={onOpenStarted} className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-bold text-ink underline underline-offset-2">
                Go to {p.changes.name ?? "the circle"}
              </button>
            )}
          </EyebrowGroup>
        </section>

        <section className="order-3">
          <EyebrowGroup label="Answers">
            {federation ? (
              <div className="flex flex-col gap-8">
                {(p.deciders ?? []).map((d) => (
                  <div key={d.circleId}>
                    <FederationDeciderName circleId={d.circleId} />
                    <div className="mt-1">
                      <FederationDeciderStatus proposal={p} decider={d} memberId={memberId} onNominate={onNominate!} onObjectToNominee={onObjectToNominee!} />
                    </div>
                    {d.releasedAt && <div className="mt-3">{answers(byId[d.circleId]?.members ?? [])}</div>}
                  </div>
                ))}
              </div>
            ) : (
              answers(deciders)
            )}
          </EyebrowGroup>
        </section>
        {onWithdraw && (
          <section className="order-4">
            <p className="mb-3 font-serif text-sm leading-snug text-soft">Withdrawing it means {WITHDRAWN[p.kind]}, and closes this proposal.</p>
            <Button variant="danger" disabled={withdrawing} onClick={() => setWithdrawing(true)} className="w-full min-[480px]:w-auto">
              Withdraw
            </Button>
            {withdrawError && <p className="mt-3 font-sans text-sm font-bold text-danger">{withdrawError}</p>}
          </section>
        )}
        </div>
        <div className="contents min-[960px]:flex min-[960px]:flex-col min-[960px]:gap-10">
        {open && (
          <section className="order-2">
            <EyebrowGroup label="Your answer">
              {!canAnswer ? (
                p.proposerId !== memberId ? (
                  <p className="font-serif text-base text-soft">Your circle has consented.</p>
                ) : (
                <p className="font-serif text-base text-soft">You proposed this, so you&rsquo;ve consented{consentIsRsvp && <>, and you&rsquo;re down as going</>}.</p>
                )
              ) : (
                <>
                  {stale && <p className="mb-3 font-serif text-base text-flame-text">A delegate was named since you answered. Answer again to include them.</p>}
                  {federation && <p className="mb-3 font-serif text-sm leading-snug text-soft">Objecting here ends the whole proposal.</p>}
                  {mine && <p className="mb-3 font-serif text-base">You answered: <strong className="font-sans">{RESPONSE_LABEL[mine.response]}</strong>. You can change it until it closes.</p>}
                  {consentIsRsvp && <p className="mb-3 font-serif text-sm leading-snug text-soft">Liking or accepting it also marks you as going.</p>}
                  <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3" role="group" aria-label="Your answer">
                    {(["like", "accept", "object"] as const).map((r) => {
                      const Icon = ANSWER_STYLE[r].icon;
                      // the one being weighed, or else your answer as it stands: ringed
                      // in ink inside its own edge, the others stepping back
                      const shown = choice ?? mine?.response ?? null;
                      const selected = shown === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setError(null);
                            // your own answer needs no confirming: choosing it again clears the choice
                            setChoice((c) => (c === r || (r === mine?.response && !stale) ? null : r));
                          }}
                          aria-pressed={selected}
                          className={clsx(
                            "inline-flex cursor-pointer items-center justify-center gap-2 border px-4 py-4 font-sans text-sm font-extrabold tracking-open transition-opacity duration-(--motion-small) disabled:cursor-default disabled:opacity-60",
                            ANSWER_STYLE[r].button,
                            selected && "shadow-[inset_0_0_0_2px_var(--color-ink)]",
                            shown !== null && !selected && "opacity-60",
                          )}
                        >
                          <Icon className="size-5 shrink-0" strokeWidth={2} aria-hidden />
                          {RESPONSE_LABEL[r]}
                        </button>
                      );
                    })}
                  </div>
                  {choice === "object" ? (
                    <div className="mt-4 border-l-4 border-danger pl-4">
                      <label htmlFor="objection" className="block font-sans text-sm font-extrabold">
                        Why do you object?
                      </label>
                      <p className="mt-1 font-serif text-sm leading-snug text-soft">
                        An objection stops the proposal. Say what would need to change for you to consent.
                      </p>
                      <TextArea id="objection" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={OBJECTION_REASON_MAX} rows={3} className="mt-3" />
                      <div className="mt-3 flex gap-3">
                        <Button variant="danger" disabled={busy || !reason.trim()} onClick={() => answer("object")}>
                          Object
                        </Button>
                        <Button variant="secondary" disabled={busy} onClick={() => setChoice(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    choice !== null && (
                      <div className="mt-4 border border-ink bg-paper p-4">
                        <div className="font-sans text-sm font-extrabold">{choice === "like" ? "Confirm that you like this" : "Confirm that you accept this"}</div>
                        <p className="mt-1 font-serif text-sm leading-snug text-soft">
                          {choice === "like" ? "You consent, and you’re glad of it." : "You consent, though it isn’t your first choice."} You can change your answer until it closes.
                        </p>
                        <div className="mt-3 flex gap-3">
                          <Button disabled={busy || (mine?.response === choice && !stale)} onClick={() => answer(choice)}>
                            Confirm
                          </Button>
                          <Button variant="secondary" disabled={busy} onClick={() => setChoice(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                  {error && <p className="mt-3 font-sans text-sm font-bold text-danger">{error}</p>}
                </>
              )}
            </EyebrowGroup>
          </section>
        )}

        </div>
      </div>

      {withdrawing && onWithdraw && (
        <ConfirmModal
          title="Withdraw this proposal?"
          message={`${WITHDRAWN[p.kind].replace(/^./, (ch) => ch.toUpperCase())}, and the proposal closes. It can be proposed again.`}
          confirmLabel="Withdraw"
          cancelLabel="Keep it"
          onCancel={() => setWithdrawing(false)}
          onConfirm={async () => {
            setWithdrawError(null);
            const result = await onWithdraw();
            setWithdrawing(false);
            if (!result.ok) setWithdrawError(result.error);
          }}
        />
      )}
    </PageContainer>
  );
}

// what withdrawing each kind means
const WITHDRAWN: Record<CircleProposal["kind"], string> = {
  change: "the change won’t be made",
  event: "the event won’t be held",
  post: "it won’t be posted",
  new_circle: "the circle won’t be started",
  remove_message: "the message won’t be removed",
  coordinating_circle: "the federation won’t be formed",
};

// what becomes of each kind: "it's {made}", "{done}", "it won't be {notDone}"
const WORDS: Record<CircleProposal["kind"], { made: string; done: string; notDone: string }> = {
  change: { made: "made", done: "the change was made", notDone: "made" },
  event: { made: "scheduled", done: "the event was scheduled", notDone: "held" },
  post: { made: "posted", done: "it was posted to the neighborhood's bulletin", notDone: "posted" },
  new_circle: { made: "started", done: "the circle was started", notDone: "started" },
  remove_message: { made: "removed", done: "the message was removed", notDone: "removed" },
  coordinating_circle: { made: "formed", done: "the federation was formed", notDone: "formed" },
};

// until when it's open and what happens then, or how it ended — for an event,
// whether it's scheduled
function Outcome({ proposal: p, objectorName }: { proposal: CircleProposal; objectorName?: string }) {
  const { made, done, notDone } = WORDS[p.kind];
  const federation = p.kind === "coordinating_circle";
  const [Icon, tone, heading, text] =
    p.status === "open"
      ? [HandRaisedIcon, "bg-flame text-on-action", `Open until ${fmtDateTime(new Date(p.closesAt))}`, federation ? "Each circle consents in turn, and it's formed once they all have. Silence by then is consent." : `If no one objects by then, it's ${made}. It's ${made} sooner if everyone consents.`]
      : p.status === "passed"
        ? [CheckCircleIcon, "bg-tint-leaf text-on-action", "Passed", `No one objected, so ${done}${p.decidedAt ? ` on ${fmtDateTime(new Date(p.decidedAt))}` : ""}.`]
        : p.status === "withdrawn"
          ? p.lapsed && federation
            ? [XCircleIcon, "bg-wash text-soft", "Withdrawn automatically", "A circle had no delegate or could no longer join, so the federation won't be formed. It can be proposed again."]
            : p.lapsed
            ? [XCircleIcon, "bg-wash text-soft", "Withdrawn automatically", "Its start time came before the circle had decided, so it was withdrawn and the event won't be held. It can be proposed again for another time."]
            : [XCircleIcon, "bg-wash text-soft", "Withdrawn", `It was withdrawn before it was decided, so it won't be ${notDone}. It can be proposed again.`]
          : [XCircleIcon, "bg-tint-danger text-on-action", "Objected", `${objectorName ?? "A member"} objected, so it won't be ${notDone}. It can be proposed again, changed to meet the objection.`];
  return (
    <div role="status" className="mt-6 flex items-start gap-3 border border-ink bg-paper px-4 py-3">
      {/* the state in a tile: flame while it waits, as everywhere a decision does */}
      <span className={clsx("flex size-9 shrink-0 items-center justify-center border border-ink", tone)}>
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div>
        <div className="font-sans text-sm font-extrabold tracking-open">{heading}</div>
        <p className="mt-1 font-serif text-sm leading-relaxed text-body">{text}</p>
      </div>
    </div>
  );
}
