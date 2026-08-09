import { PencilIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { BackButton } from "@/components/chrome/back-button";
import { Chip } from "@/components/chrome/chip";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { Tag } from "@/components/chrome/tag";
import { GovernanceRow } from "@/components/events/governance-row";
import { OrdinaryRow } from "@/components/events/ordinary-row";
import { useAppState } from "@/components/providers/app-state-provider";
import { avatarFor, memberById } from "@/lib/data";
import { fmtEditDate, parseDay } from "@/lib/format.util";
import { kindOf } from "@/lib/governance.util";
import { useIsMobile } from "@/lib/hooks";
import { FAINT, INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

export function OrgPage({ org: o, isMember, lastEditor, lastEditedAt, events, rsvpState, toggleRsvp, voteState, toggleVote, onBack, backLabel, onOpenMember, onOpenEvent, onManage }) {
  const isMobile = useIsMobile();
  const { profile } = useAppState();
  const members = o.members.map(memberById).filter(Boolean);
  // events convened by this org, soonest first (location is irrelevant)
  const hostedEvents = [...events]
    .filter((e) => e.host.type === "org" && e.host.id === o.id)
    .sort((a, b) => parseDay(a.date) - parseDay(b.date));

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 24px 80px" }}>
      <BackButton onClick={onBack}>{backLabel || "All organizations"}</BackButton>

      <div
        style={{
          borderTop: `3px solid ${INK}`, borderBottom: `1px solid ${INK}`, marginTop: 16, paddingTop: 16, paddingBottom: 22,
          display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 18 : 20, alignItems: isMobile ? "stretch" : "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Eyebrow style={{ color: SOFT }}>{o.kind}</Eyebrow>
            <Chip title={o.level === profile.neighborhood ? "Local to this neighborhood" : "Across the federation"}>{o.level}</Chip>
          </div>
          <h1 style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.title, letterSpacing: "-0.035em", lineHeight: 0.92, margin: "12px 0 0" }}>{o.name}</h1>
          <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: TYPE.xl, color: "#222", margin: "14px 0 0" }}>{o.tagline}</p>
          {lastEditor && (
            <div style={{ marginTop: 16, fontFamily: sans, fontSize: TYPE.label, letterSpacing: "0.02em", color: SOFT }}>
              Last edited by{" "}
              <button
                onClick={() => onOpenMember(lastEditor)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: sans, fontSize: TYPE.label, letterSpacing: "0.02em", color: INK, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2 }}
              >
                {lastEditor.name}
              </button>
              {lastEditedAt ? ` · ${fmtEditDate(lastEditedAt)}` : ""}
            </div>
          )}
        </div>
        {isMember && (
          <button
            onClick={onManage}
            className={clsx(
              "ink-press inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer",
              "font-sans text-xs tracking-wide uppercase font-bold py-3 px-4.5 border border-ink bg-paper text-ink",
              isMobile ? "self-stretch w-full" : "self-start w-auto"
            )}
          >
            <PencilIcon className="size-3.5" strokeWidth={2.5} />
            Manage
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${o.facts.length}, 1fr)`, borderBottom: `1px solid ${INK}` }}>
        {o.facts.map(([k, v], i) => (
          <div key={k} style={{ padding: "16px 14px", borderRight: i < o.facts.length - 1 ? `1px solid ${FAINT}` : "none" }}>
            <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>{k}</Eyebrow>
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.lg, letterSpacing: "-0.01em", marginTop: 8 }}>{v}</div>
          </div>
        ))}
      </div>

      <section style={{ padding: "32px 0", borderBottom: `1px solid ${FAINT}` }}>
        <Eyebrow style={{ color: SOFT }}>About</Eyebrow>
        <p style={{ fontFamily: serif, fontSize: TYPE.lg, lineHeight: 1.55, margin: "14px 0 0", maxWidth: "40em" }}>{o.about}</p>
      </section>

      <section style={{ padding: "32px 0", borderBottom: `1px solid ${FAINT}` }}>
        <Eyebrow style={{ color: SOFT }}>What they offer</Eyebrow>
        <div style={{ marginTop: 14 }}>
          {o.offers.map((s) => <Tag key={s}>{s}</Tag>)}
        </div>
      </section>

      <section style={{ padding: "32px 0", borderBottom: `1px solid ${FAINT}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${INK}`, paddingBottom: 11 }}>
          <Eyebrow style={{ color: SOFT }}>Events they host</Eyebrow>
          <span style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.xs }}>{hostedEvents.length}</span>
        </div>
        {hostedEvents.length > 0 ? (
          <div style={{ marginTop: 4 }}>
            {hostedEvents.map((e) => (
              kindOf(e).governance
                ? <GovernanceRow key={e.id} e={e} voteState={voteState} toggleVote={toggleVote} onOpenEvent={onOpenEvent} />
                : <OrdinaryRow key={e.id} e={e} rsvpState={rsvpState} toggleRsvp={toggleRsvp} onOpenEvent={onOpenEvent} />
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: serif, fontSize: TYPE.base, color: SOFT, margin: "16px 0 0" }}>
            No upcoming events hosted by {o.name}.
          </p>
        )}
      </section>

      <section style={{ padding: "32px 0", borderBottom: `1px solid ${FAINT}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Eyebrow style={{ color: SOFT }}>Members</Eyebrow>
          <span style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.xs }}>{members.length}</span>
        </div>
        {members.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))", gap: 0, marginTop: 16, borderTop: `1px solid ${INK}`, borderLeft: `1px solid ${INK}` }}>
            {members.map((m) => (
              <button
                key={m.id}
                className="ink-press"
                onClick={() => onOpenMember(m)}
                style={{
                  textAlign: "left", background: PAPER, border: "none",
                  borderRight: `1px solid ${INK}`, borderBottom: `1px solid ${INK}`,
                  padding: 14, cursor: "pointer", display: "flex", gap: 12, alignItems: "center",
                }}
              >
                <img src={avatarFor(m)} alt="" style={{ width: 44, height: 44, objectFit: "cover", filter: "grayscale(100%)", border: `1px solid ${INK}`, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.sm }}>{m.name}</div>
                  <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>{m.role}</Eyebrow>
                  <div style={{ marginTop: 6 }}>
                    <Chip title={`Neighborhood: ${m.neighborhood}`}>{m.neighborhood}</Chip>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: serif, fontSize: TYPE.base, color: SOFT, margin: "16px 0 0" }}>
            No members of {o.name} are listed here yet.
          </p>
        )}
      </section>

      {(o.website || o.address || (o.hours && o.hours.length > 0)) && (
      <section style={{ padding: "32px 0 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${INK}`, paddingBottom: 11 }}>
          <Eyebrow style={{ color: SOFT }}>Visit</Eyebrow>
        </div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 0, border: `1px solid ${FAINT}` }}>
          <div style={{ padding: "16px 18px", borderRight: `1px solid ${FAINT}`, borderBottom: `1px solid ${FAINT}` }}>
            <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>Website</Eyebrow>
            <div style={{ marginTop: 8 }}>
              {o.website
                ? <a href={`https://${o.website}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: sans, fontSize: TYPE.sm, fontWeight: 700, color: INK, textDecoration: "none", wordBreak: "break-all" }}>{o.website} ↗</a>
                : <span style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT }}>—</span>}
            </div>
          </div>
          <div style={{ padding: "16px 18px", borderRight: `1px solid ${FAINT}`, borderBottom: `1px solid ${FAINT}` }}>
            <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>Address</Eyebrow>
            <div style={{ marginTop: 8 }}>
              {o.address
                ? o.address.split(",").map((line, i) => (
                    <div key={i} style={{ fontFamily: serif, fontSize: TYPE.sm, color: "#222", lineHeight: 1.4 }}>{line.trim()}</div>
                  ))
                : <span style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT }}>—</span>}
            </div>
          </div>
          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${FAINT}` }}>
            <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>Open hours</Eyebrow>
            <div style={{ marginTop: 8 }}>
              {o.hours && o.hours.length > 0
                ? o.hours.map(([d, t]) => (
                    <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontFamily: serif, fontSize: TYPE.sm, color: "#222", padding: "1px 0" }}>
                      <span style={{ color: SOFT }}>{d}</span>
                      <span>{t}</span>
                    </div>
                  ))
                : <span style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT }}>—</span>}
            </div>
          </div>
        </div>
      </section>
      )}

      <section style={{ padding: "32px 0 0" }}>
        <div className="grid grid-cols-1 min-[720px]:grid-cols-2 border border-ink">
          <div className="border-b border-ink min-[720px]:border-b-0 min-[720px]:border-r" style={{ padding: 24 }}>
            <Eyebrow style={{ color: SOFT }}>How to join</Eyebrow>
            <p style={{ fontFamily: serif, fontSize: TYPE.base, lineHeight: 1.5, margin: "12px 0 0" }}>{o.join}</p>
          </div>
          <div style={{ padding: 24, background: INK, color: PAPER }}>
            <Eyebrow style={{ color: "#bdbdbd" }}>Get in touch</Eyebrow>
            <p style={{ fontFamily: sans, fontSize: TYPE.lg, fontWeight: 700, margin: "12px 0 0", overflowWrap: "break-word" }}>{o.contact}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
