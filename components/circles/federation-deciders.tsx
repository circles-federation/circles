"use client";

import { useState } from "react";
import { Button, Eyebrow, RichSelect, TextArea, useToast } from "@/components/shared";
import type { MutationResult } from "@/components/providers/app-state-provider";
import { rolesHeldBy } from "@/lib/circle-roles.util";
import { NOMINEE_REASON_MAX } from "@/lib/federation.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import type { CircleProposal, Member, ProposalDecider } from "@/lib/types";

interface FederationDeciderProps {
  proposal: CircleProposal;
  decider: ProposalDecider;
  memberId: number;
  onNominate: (circleId: string, memberId: number) => Promise<MutationResult>;
  onObjectToNominee: (circleId: string, reason: string) => Promise<MutationResult>;
}

/* Where one circle stands on a proposed federation, over its members' answers:
   whether it has consented, and the delegate it sends. While a circle that's
   being asked is the viewer's, they put someone forward, or object to whoever
   has been, which drops that person and leaves the proposal open. The first
   circle's delegate is part of the proposal itself. */
export function FederationDeciderStatus({ proposal: p, decider: d, memberId, onNominate, onObjectToNominee }: FederationDeciderProps) {
  const byId = useCirclesById();
  const memberById = useMemberById();
  const { showToast } = useToast();
  const [pick, setPick] = useState<number | null>(null);
  const [objecting, setObjecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const circle = byId[d.circleId];
  const first = byId[p.circleId]?.name ?? "the first circle";
  const nominee = d.nominees.find((n) => n.status !== "objected");
  const nomineeName = nominee ? (memberById(nominee.memberId)?.name ?? "A former member") : undefined;
  const mine = !!circle?.members.includes(memberId);
  const asked = p.status === "open" && !!d.releasedAt && !d.passedAt;
  const canAct = asked && d.stage === 2 && mine;
  const status = d.passedAt ? "Consented" : p.status !== "open" ? "Didn't consent" : d.releasedAt ? "Deciding" : `Asked once ${first} consents`;

  async function run(action: () => Promise<MutationResult>, done: string) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setObjecting(false);
    setReason("");
    setPick(null);
    showToast({ tone: "success", message: done });
  }

  return (
    <div>
      <p className="font-sans text-sm text-soft">{status}</p>
      {d.releasedAt && (
        <p className="mt-1 font-serif text-base">
          Delegate: {nomineeName ? <strong className="font-sans">{nomineeName}</strong> : <span className="text-soft">no one yet</span>}
        </p>
      )}
      {d.nominees
        .filter((n) => n.status === "objected")
        .map((n) => (
          <p key={n.id} className="mt-1 font-serif text-sm leading-snug text-soft">
            {(n.objectedBy !== null && n.objectedBy !== undefined && memberById(n.objectedBy)?.name) || "A member"} objected to {memberById(n.memberId)?.name ?? "a former member"}
            {n.objectionReason && <>: <span className="italic">&ldquo;{n.objectionReason}&rdquo;</span></>}
          </p>
        ))}

      {canAct && !nominee && circle && (
        <div className="mt-3">
          <RichSelect
            label={`${circle.name}'s delegate`}
            placeholder="Choose a delegate"
            value={pick !== null ? String(pick) : null}
            onChange={(v) => setPick(Number(v))}
            options={circle.members
              .map(memberById)
              .filter((m): m is Member => !!m)
              .map((m) => ({ value: String(m.id), label: m.name, badges: rolesHeldBy(circle, m.id) }))}
          />
          <Button size="compact" disabled={busy || pick === null} onClick={() => pick !== null && run(() => onNominate(d.circleId, pick), "Put forward. The circle's been told.")} className="mt-3">
            Put forward
          </Button>
        </div>
      )}

      {canAct && nominee && !objecting && (
        <Button variant="secondary" size="compact" onClick={() => setObjecting(true)} className="mt-3">
          Object to this delegate
        </Button>
      )}
      {canAct && nominee && objecting && (
        <div className="mt-3 border-l-4 border-danger pl-4">
          <label htmlFor={`nominee-${d.circleId}`} className="block font-sans text-sm font-extrabold">
            Why not {nomineeName}?
          </label>
          <p className="mt-1 font-serif text-sm leading-snug text-soft">The proposal stays open for someone else.</p>
          <TextArea id={`nominee-${d.circleId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={NOMINEE_REASON_MAX} rows={3} className="mt-3" />
          <div className="mt-3 flex gap-3">
            <Button variant="danger" size="compact" disabled={busy || !reason.trim()} onClick={() => run(() => onObjectToNominee(d.circleId, reason), "Your objection is in. The circle's been told.")}>
              Object
            </Button>
            <Button variant="secondary" size="compact" disabled={busy} onClick={() => setObjecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 font-sans text-sm font-bold text-danger">{error}</p>}
    </div>
  );
}

// the heading over one circle's part of a federation's answers
export function FederationDeciderName({ circleId }: { circleId: string }) {
  const circle = useCirclesById()[circleId];
  return <Eyebrow className="text-soft">{circle?.name ?? "A circle"}</Eyebrow>;
}
