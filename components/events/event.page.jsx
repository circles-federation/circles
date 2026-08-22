"use client";

import { DateTile } from "./date-tile";
import { VoteButton } from "./vote-button";
import { RsvpButton } from "./rsvp-button";
import { BackButton } from "@/components/chrome/back-button";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { MEMBERS, COUNCIL_RATIFY_THRESHOLD, avatarFor, hostInfo, memberById } from "@/lib/data";
import { FEDERATION_COUNCIL_ENABLED } from "@/lib/feature-flags";
import { MONTHS, WEEKDAYS, fmtEditDate, fmtTime, isPastEvent, parseDay } from "@/lib/format.util";
import {
  canReadDetails,
  canVote,
  endorsementCount,
  isConfirmed,
  isExclusive,
  isHostOrgMember,
  kindOf,
  neighborhoodMajority,
  scopeLabel,
  voteCount,
} from "@/lib/governance.util";
import { hasRoles, roleFull, roleShort, roleUnmet, shiftCancelled, shiftNeedsSlots } from "@/lib/roles.util";
import { FAINT, FLAME, INK, LEAF, PAPER, PLUM, SOFT, TYPE, sans, serif } from "@/lib/theme";

export function EventPage({ event: e, events, profile, councilProposals, rsvpState, toggleRsvp, voteState, toggleVote, onBack, backLabel, onOpenMember, onOpenOrg, onOpenEvent, onToggleRoleSlot, onProposeCouncil, onRatifyProposal, onProposeEndorsingAssembly }) {
  const k = kindOf(e);
  const h = hostInfo(e.host);
  const going = rsvpState[e.id];
  // rsvps is kept in sync by toggleRsvp, so it already includes the current user when going
  const attendees = e.rsvps.map(memberById).filter(Boolean);
  const d = parseDay(e.date);
  const gov = k.governance;
  const votes = voteCount(e);
  const confirmed = isConfirmed(e);
  const voted = voteState[e.id];
  const govAccent = confirmed ? LEAF : FLAME; // green once confirmed, orange while proposed
  const past = isPastEvent(e);
  const exclusive = isExclusive(e);
  const isHostMember = isHostOrgMember(e, profile);
  const accentColor = gov ? (past && !confirmed ? SOFT : govAccent) : (past ? SOFT : (exclusive ? PLUM : INK));
  const eligible = gov && canVote(e, profile);
  const canRead = canReadDetails(e, profile);
  const isAssembly = e.kind === "assembly";
  const isCouncil = e.kind === "council";
  const isResident = canVote(e, profile);
  // this assembly's own council proposals (drafts + ratified)
  const myProposals = (councilProposals || []).filter((p) => p.assemblyId === e.id);
  const myHood = profile.neighborhood;
  const councilMajority = neighborhoodMajority();

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 24px 80px" }}>
      <BackButton onClick={onBack}>{backLabel || "All events"}</BackButton>

      {/* masthead */}
      <div style={{ borderTop: `3px solid ${accentColor}`, borderBottom: `1px solid ${INK}`, marginTop: 16, paddingTop: 18, paddingBottom: 22, display: "flex", gap: 22, alignItems: "flex-start" }}>
        <DateTile iso={e.date} large accentColor={gov ? govAccent : (exclusive ? PLUM : undefined)} />
        <div style={{ flex: 1 }}>
          {gov && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Eyebrow style={{ color: govAccent }}>{k.label}</Eyebrow>
              <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.label, letterSpacing: "0.08em", textTransform: "uppercase", color: govAccent, border: `1px solid ${govAccent}`, padding: "2px 7px" }}>
                {confirmed ? "Confirmed" : "Proposed"}
              </span>
            </div>
          )}
          {exclusive && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.label, letterSpacing: "0.08em", textTransform: "uppercase", color: PLUM, border: `1px solid ${PLUM}`, padding: "2px 7px" }}>
                ◆ Members only
              </span>
            </div>
          )}
          <Eyebrow style={{ color: SOFT }}>
            {e.date && !isNaN(d.getTime())
              ? <>{WEEKDAYS[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()} · {fmtTime(e.start)}–{fmtTime(e.end)}</>
              : <>Date to be set · {fmtTime(e.start)}–{fmtTime(e.end)}</>}
          </Eyebrow>
          <h1 className="mt-3 font-sans text-heading min-[720px]:text-title font-extrabold tracking-[-0.035em] leading-[0.95]">{e.title}</h1>
          {isCouncil && e.sponsor && (
            <button
              onClick={() => { const a = (events || []).find((x) => x.id === e.sponsor.id); if (a) onOpenEvent(a); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, margin: "12px 0 0", display: "block", textAlign: "left" }}
            >
              <Eyebrow style={{ color: FLAME, fontSize: TYPE.micro }}>Convened by {e.sponsor.name} →</Eyebrow>
            </button>
          )}
          <p style={{ fontFamily: serif, fontSize: TYPE.lg, color: "#222", margin: "12px 0 0" }}>{e.location}</p>
        </div>
      </div>

      {/* governance status banner — assemblies confirm by resident votes;
          councils confirm by neighborhood endorsements (shown separately) */}
      {gov && !isCouncil && (
        <div style={{ borderBottom: `1px solid ${FAINT}`, padding: "16px 0", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontFamily: serif, fontSize: TYPE.base, margin: 0, color: "#222", lineHeight: 1.45 }}>
              {confirmed
                ? <>Quorum met — this meeting is <span style={{ color: LEAF, fontWeight: 700 }}>confirmed</span> for {scopeLabel(e)}.</>
                : <>This {k.label.toLowerCase()} needs <strong>{k.threshold}</strong> votes from {scopeLabel(e)} to be held. <span style={{ color: FLAME, fontWeight: 700 }}>{k.threshold - votes} more</span> to confirm.</>}
            </p>
            {/* progress rail */}
            <div style={{ height: 6, background: FAINT, marginTop: 12 }}>
              <div style={{ height: 6, background: govAccent, width: `${Math.min(100, (votes / k.threshold) * 100)}%`, transition: "width .3s" }} />
            </div>
            {!eligible && (
              <p style={{ fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.02em", color: SOFT, margin: "10px 0 0", lineHeight: 1.4 }}>
                Voting and attending is limited to residents of {scopeLabel(e)}.
              </p>
            )}
          </div>
          <VoteButton
            voted={voted}
            count={votes}
            threshold={k.threshold}
            onToggle={() => toggleVote(e.id)}
            big
            eligible={eligible}
            ineligibleNote={`Only people in ${scopeLabel(e)} can vote on this`}
            past={past}
          />
        </div>
      )}

      {/* past council: brief held/lapsed summary */}
      {isCouncil && past && (
        <div style={{ borderBottom: `1px solid ${FAINT}`, padding: "16px 0" }}>
          <p style={{ fontFamily: serif, fontSize: TYPE.base, margin: 0, color: "#222", lineHeight: 1.45 }}>
            {confirmed
              ? <>This federation council meeting was <span style={{ color: LEAF, fontWeight: 700 }}>held</span> — endorsed by {endorsementCount(e)} neighborhoods.</>
              : <>This federation council meeting <span style={{ color: SOFT, fontWeight: 700 }}>lapsed</span> — it reached {endorsementCount(e)} of {councilMajority} needed endorsements.</>}
          </p>
        </div>
      )}

      {/* on a confirmed assembly: propose a federation council + list this
          assembly's proposals with ratification voting */}
      {isAssembly && confirmed && !past && FEDERATION_COUNCIL_ENABLED && (
        <div style={{ border: `1px solid ${FLAME}`, padding: "18px 20px", marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Eyebrow style={{ color: FLAME }}>Federation council</Eyebrow>
              <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: "#222", lineHeight: 1.5, margin: "8px 0 0", maxWidth: "42em" }}>
                As a confirmed assembly, {scopeLabel(e)} can put forward a federation council meeting. A delegate drafts the proposal; attendees then vote to ratify it.
              </p>
            </div>
            {isResident && (
              <button
                onClick={() => onProposeCouncil(e)}
                className="btn-invert btn-ink"
                style={{
                  fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.1em", textTransform: "uppercase",
                  fontWeight: 700, cursor: "pointer", padding: "13px 20px",
                  border: `1px solid ${FLAME}`, background: FLAME, color: PAPER, whiteSpace: "nowrap",
                }}
              >
                Propose
              </button>
            )}
          </div>

          {myProposals.length > 0 && (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              {myProposals.map((p) => {
                const rv = p.ratifyVotes.length;
                const ratified = p.ratified;
                const mineVoted = p.ratifyVotes.includes(profile.id);
                return (
                  <div key={p.id} style={{ border: `1px solid ${ratified ? LEAF : FAINT}`, borderLeft: `4px solid ${ratified ? LEAF : FLAME}`, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                      <span style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.base }}>{p.title}</span>
                      <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.label, letterSpacing: "0.08em", textTransform: "uppercase", color: ratified ? LEAF : FLAME }}>
                        {ratified ? "✓ Ratified" : `Ratifying · ${rv}/${COUNCIL_RATIFY_THRESHOLD}`}
                      </span>
                    </div>
                    <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT, margin: "6px 0 0", lineHeight: 1.4 }}>
                      {p.date ? `${fmtEditDate(p.date)} · ` : ""}{p.location}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                      {!ratified ? (
                        <>
                          <div style={{ height: 6, background: FAINT, flex: 1, minWidth: 140, maxWidth: 280 }}>
                            <div style={{ height: 6, background: FLAME, width: `${Math.min(100, (rv / COUNCIL_RATIFY_THRESHOLD) * 100)}%`, transition: "width .3s" }} />
                          </div>
                          {isResident ? (
                            <button
                              onClick={() => onRatifyProposal(p.id)}
                              style={{
                                fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
                                cursor: "pointer", padding: "9px 14px", whiteSpace: "nowrap",
                                border: `1px solid ${FLAME}`, background: mineVoted ? FLAME : PAPER, color: mineVoted ? PAPER : FLAME,
                              }}
                            >
                              {mineVoted ? "✓ Ratified by you" : "Ratify"}
                            </button>
                          ) : (
                            <span style={{ fontFamily: sans, fontSize: TYPE.eyebrow, color: SOFT }}>Only {scopeLabel(e)} can ratify</span>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => { const c = (events || []).find((x) => x.id === p.councilId); if (c) onOpenEvent(c); }}
                          style={{
                            fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
                            cursor: "pointer", padding: "9px 14px", whiteSpace: "nowrap",
                            border: `1px solid ${LEAF}`, background: LEAF, color: PAPER,
                          }}
                        >
                          View federation council meeting →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* on a council: endorsement status + propose an assembly in your hood */}
      {isCouncil && !past && (
        <div style={{ border: `1px solid ${confirmed ? LEAF : FLAME}`, padding: "18px 20px", marginTop: 24 }}>
          <Eyebrow style={{ color: confirmed ? LEAF : FLAME }}>Neighborhood endorsements</Eyebrow>
          <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: "#222", lineHeight: 1.5, margin: "8px 0 0", maxWidth: "42em" }}>
            A federation council meeting is confirmed once a majority of neighborhoods endorse it — <strong>{councilMajority}</strong> of {new Set(MEMBERS.map((m) => m.neighborhood)).size}. Each neighborhood endorses by passing an assembly vote of its own.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {(e.endorsements || []).map((hood) => (
              <span key={hood} style={{ fontFamily: sans, fontSize: TYPE.eyebrow, fontWeight: 700, letterSpacing: "0.04em", padding: "6px 11px", border: `1px solid ${LEAF}`, color: LEAF }}>
                ✓ {hood}
              </span>
            ))}
            {(e.endorsements || []).length === 0 && (
              <span style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT }}>No endorsements yet.</span>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
            <div style={{ height: 6, background: FAINT, flex: 1, minWidth: 160, maxWidth: 320 }}>
              <div style={{ height: 6, background: confirmed ? LEAF : FLAME, width: `${Math.min(100, (endorsementCount(e) / councilMajority) * 100)}%`, transition: "width .3s" }} />
            </div>
            {!(e.endorsements || []).includes(myHood) && myHood && (
              <button
                onClick={() => onProposeEndorsingAssembly(e, myHood)}
                className="btn-invert btn-ink"
                style={{
                  fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
                  cursor: "pointer", padding: "11px 16px", whiteSpace: "nowrap",
                  border: `1px solid ${FLAME}`, background: FLAME, color: PAPER,
                }}
              >
                Propose {myHood} assembly →
              </button>
            )}
            {(e.endorsements || []).includes(myHood) && (
              <span style={{ fontFamily: sans, fontSize: TYPE.eyebrow, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: LEAF }}>
                ✓ {myHood} endorsed
              </span>
            )}
          </div>
        </div>
      )}

      {/* a required slot is unfilled but there's still time — neutral warning */}
      {hasRoles(e) && shiftNeedsSlots(e) && (
        <div style={{ border: `1px solid ${INK}`, borderLeft: `4px solid ${FLAME}`, background: "rgba(225,83,11,0.05)", padding: "16px 18px", marginTop: 24, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: TYPE.lg, lineHeight: 1.1, color: FLAME }}>⚠</span>
          <div>
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.sm, letterSpacing: "0.02em" }}>Still needs a {e.roles.filter(roleUnmet).map((r) => r.label.toLowerCase()).join(" and ")}</div>
            <p style={{ fontFamily: serif, fontSize: TYPE.sm, lineHeight: 1.5, margin: "6px 0 0", color: "#222" }}>
              This shift will be cancelled if the required slot isn’t filled by an hour before it starts. Sign up below to keep it on.
            </p>
          </div>
        </div>
      )}

      {/* a slotted shift is cancelled when a required role is unfilled within
          the final hour before start (through the end time) */}
      {hasRoles(e) && shiftCancelled(e) && (
        <div style={{ border: `2px solid ${INK}`, background: INK, color: PAPER, padding: "16px 18px", marginTop: 24, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: TYPE.lg, lineHeight: 1.1 }}>⚠</span>
          <div>
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.sm, letterSpacing: "0.02em" }}>Open hours cancelled</div>
            <p style={{ fontFamily: serif, fontSize: TYPE.sm, lineHeight: 1.5, margin: "6px 0 0", color: PAPER }}>
              This shift can’t run without a {e.roles.filter(roleUnmet).map((r) => r.label.toLowerCase()).join(" and ")}. You can still take the open slot up to the end time and the shift is back on.
            </p>
          </div>
        </div>
      )}

      {/* host + rsvp action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, borderBottom: `1px solid ${FAINT}`, padding: "18px 0", flexWrap: "wrap" }}>
        <button
          onClick={() => (h.org ? onOpenOrg(h.org) : onOpenMember(h.member))}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 12 }}
        >
          {h.avatar
            ? <img src={h.avatar} alt="" style={{ width: 40, height: 40, objectFit: "cover", border: `1px solid ${INK}` }} />
            : <div style={{ width: 40, height: 40, border: `1px solid ${INK}`, background: INK, color: PAPER, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, fontWeight: 800, fontSize: TYPE.lg }}>{h.label[0]}</div>}
          <div style={{ textAlign: "left" }}>
            <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>{gov ? "Proposed by" : "Hosted by"}</Eyebrow>
            <div style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.base }}>{h.label} →</div>
          </div>
        </button>
        {/* assemblies have no separate RSVP — voting above is how you attend */}
        {!hasRoles(e) && !isAssembly && <RsvpButton going={going} count={attendees.length} onToggle={() => toggleRsvp(e.id)} big disabled={past || (exclusive && !isHostMember)} reason={past ? "past" : ((exclusive && !isHostMember) ? "membersOnly" : undefined)} />}
        {hasRoles(e) && (
          <div style={{ textAlign: "right" }}>
            <Eyebrow style={{ color: shiftCancelled(e) ? SOFT : (shiftNeedsSlots(e) ? FLAME : LEAF) }}>{shiftCancelled(e) ? "Not running" : (shiftNeedsSlots(e) ? "Needs slots" : "Shift on")}</Eyebrow>
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.base }}>{e.roles.reduce((n, r) => n + roleShort(r), 0)} signed up</div>
          </div>
        )}
      </div>

      {/* members-only explainer: visible to all, but RSVP and notifications are member-only */}
      {exclusive && (
        <div style={{ border: `1px solid ${PLUM}`, borderLeft: `4px solid ${PLUM}`, background: "rgba(106,61,154,0.05)", padding: "16px 18px", marginTop: 20 }}>
          <Eyebrow style={{ color: PLUM }}>Members-only event</Eyebrow>
          <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: "#222", lineHeight: 1.5, margin: "8px 0 0", maxWidth: "44em" }}>
            Anyone can see this event, but only members of {h.label} can RSVP, and only members are emailed about it.
            {isHostMember
              ? " You're a member, so you can RSVP and you'll be notified."
              : " You're not a member, so RSVP is closed and you won't be emailed about it."}
          </p>
        </div>
      )}

      {/* description — redacted for non-residents of an assembly's neighborhood */}
      <section style={{ padding: "32px 0", borderBottom: `1px solid ${FAINT}` }}>
        <Eyebrow style={{ color: SOFT }}>Details</Eyebrow>
        {canRead ? (
          <p style={{ fontFamily: serif, fontSize: TYPE.lg, lineHeight: 1.55, margin: "14px 0 0", maxWidth: "40em" }}>{e.description}</p>
        ) : (
          <div style={{ marginTop: 16, maxWidth: "40em" }}>
            {/* blacked-out bars standing in for the redacted agenda */}
            <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
              {[100, 92, 96, 70].map((w, i) => (
                <span key={i} style={{ height: 16, width: `${w}%`, background: INK, display: "block" }} />
              ))}
            </div>
            <div style={{ border: `1px solid ${INK}`, padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontFamily: serif, fontSize: TYPE.lg, lineHeight: 1.1 }}>🔒</span>
              <p style={{ fontFamily: serif, fontSize: TYPE.sm, lineHeight: 1.5, margin: 0 }}>
                The agenda and notes for a neighborhood assembly are visible only to residents of {scopeLabel(e)}. You’re seeing that this meeting exists, but its internal business stays within the neighborhood that convenes it.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* role slots — for shift-style events with named roles */}
      {hasRoles(e) && (
        <section style={{ padding: "32px 0 0" }}>
          <Eyebrow style={{ color: SOFT }}>Slots</Eyebrow>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 18 }}>
            {e.roles.map((role) => {
              const filled = role.members.map(memberById).filter(Boolean);
              const mine = role.members.includes(profile.id);
              const unmet = roleUnmet(role);
              const full = roleFull(role) && !mine;
              return (
                <div key={role.key} style={{ border: `1px solid ${unmet ? INK : FAINT}`, padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.lg }}>{role.label}</span>
                        {role.min > 0 ? (
                          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.label, letterSpacing: "0.08em", textTransform: "uppercase", color: unmet ? PAPER : LEAF, background: unmet ? INK : "transparent", border: `1px solid ${unmet ? INK : LEAF}`, padding: "2px 8px" }}>
                            {unmet ? "Needed" : "Filled"}
                          </span>
                        ) : (
                          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.label, letterSpacing: "0.08em", textTransform: "uppercase", color: SOFT, border: `1px solid ${FAINT}`, padding: "2px 8px" }}>
                            Optional
                          </span>
                        )}
                        {roleFull(role) && (
                          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.label, letterSpacing: "0.08em", textTransform: "uppercase", color: SOFT, border: `1px solid ${FAINT}`, padding: "2px 8px" }}>
                            Full
                          </span>
                        )}
                      </div>
                      {role.description && (
                        <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: "#333", lineHeight: 1.45, margin: "6px 0 0", maxWidth: "40em" }}>{role.description}</p>
                      )}
                      <Eyebrow style={{ color: SOFT, marginTop: 6 }}>
                        {filled.length}{role.max != null ? `/${role.max}` : ""} {filled.length === 1 && role.max == null ? "person" : "people"}{role.min > 0 ? ` · needs ${role.min}` : (role.max == null ? " · any number" : "")}
                      </Eyebrow>
                    </div>
                    <button
                      onClick={() => { if (!past && !full) onToggleRoleSlot(e.id, role.key); }}
                      disabled={past || full}
                      title={full ? "This slot is full" : undefined}
                      style={{
                        fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.08em", textTransform: "uppercase",
                        fontWeight: 700, cursor: (past || full) ? "not-allowed" : "pointer", padding: "11px 16px", whiteSpace: "nowrap",
                        border: `1px solid ${(past || full) ? FAINT : INK}`,
                        background: !past && mine ? INK : PAPER, color: (past || full) ? SOFT : (mine ? PAPER : INK),
                      }}
                    >
                      {past ? (mine ? "✓ You were in" : "Filled") : (mine ? "✓ You're in — leave" : (full ? "Full" : `Take ${role.label.toLowerCase()}`))}
                    </button>
                  </div>
                  {filled.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                      {filled.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => onOpenMember(m)}
                          style={{ display: "flex", alignItems: "center", gap: 8, background: m.id === profile.id ? "#f4f4f4" : PAPER, border: `1px solid ${INK}`, padding: "6px 10px 6px 6px", cursor: "pointer" }}
                        >
                          <img src={avatarFor(m)} alt="" style={{ width: 28, height: 28, objectFit: "cover", border: `1px solid ${INK}` }} />
                          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.xs }}>{m.name}{m.id === profile.id ? " (you)" : ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* attendees — flat roster, for non-slotted events; hidden for non-residents of an assembly */}
      {!hasRoles(e) && (
      <section style={{ padding: "32px 0 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Eyebrow style={{ color: SOFT }}>Who’s going</Eyebrow>
          {canRead && <span style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.xs }}>{attendees.length}</span>}
        </div>
        {canRead ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))", gap: 0, marginTop: 16, borderTop: `1px solid ${INK}`, borderLeft: `1px solid ${INK}` }}>
            {attendees.map((m) => (
              <button
                key={m.id}
                className="ink-press"
                onClick={() => onOpenMember(m)}
                style={{
                  textAlign: "left", background: m.id === profile.id ? "#f4f4f4" : PAPER, border: "none",
                  borderRight: `1px solid ${INK}`, borderBottom: `1px solid ${INK}`,
                  padding: 14, cursor: "pointer", display: "flex", gap: 12, alignItems: "center",
                }}
              >
                <img src={avatarFor(m)} alt="" style={{ width: 44, height: 44, objectFit: "cover", border: `1px solid ${INK}`, flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.sm }}>{m.name}{m.id === profile.id ? " (you)" : ""}</div>
                  <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>{m.role}</Eyebrow>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT, margin: "16px 0 0" }}>
            Hidden — only residents of {scopeLabel(e)} can see who’s attending.
          </p>
        )}
      </section>
      )}
    </div>
  );
}
