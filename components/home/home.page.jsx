"use client";

import { PencilIcon } from "@heroicons/react/24/outline";
import { PlayIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { Chip } from "@/components/chrome/chip";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { ForwardLink } from "@/components/chrome/forward-link";
import { OrgCard } from "@/components/orgs/org-card";
import { EventFeed } from "@/components/events/event-feed";
import { StatCard } from "./stat-card";
import { MEMBERS, ORGS, ORGS_BY_MEMBER, avatarFor } from "@/lib/data";
import { isPastEvent, parseDay } from "@/lib/format.util";
import { kindOf } from "@/lib/governance.util";
import { useIsMobile } from "@/lib/hooks";
import { FAINT, INK, PAPER, SOFT, TEAL, TYPE, sans, serif } from "@/lib/theme";

/* The user's home dashboard. Their landing surface: identity, their
   neighborhood (one panel among several now), their organizations (speed
   dial), and their events. Profile editing lives on a separate page. */
export function Home({ profile, events, rsvpState, onOpenEvent, setView, onOpenNeighbors, onOpenLocalOrgs, onPlayGame, onOpenOrg, onEditProfile }) {
  const isMobile = useIsMobile();
  const neighbors = MEMBERS.filter((m) => m.neighborhood === profile.neighborhood);
  const localOrgs = ORGS.filter((o) => o.level === profile.neighborhood);
  const upcoming = [...events].filter((e) => !isPastEvent(e)).sort((a, b) => parseDay(a.date) - parseDay(b.date));
  const assemblies = upcoming.filter((e) => kindOf(e).governance && e.scope === profile.neighborhood);

  // the user's own organizations (speed dial)
  const myOrgs = ORGS_BY_MEMBER[profile.id] || [];

  // the user's events — created or RSVP'd, upcoming first then past
  // the user's events — created or RSVP'd; EventFeed orders and paginates them
  const myEvents = events.filter((e) => (e.rsvps || []).includes(profile.id) || rsvpState[e.id] || (e.host && e.host.type === "member" && e.host.id === profile.id));

  const avatarSize = isMobile ? 64 : 96;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 24px 80px" }}>
      {/* identity masthead */}
      <div style={{ borderTop: `3px solid ${INK}`, borderBottom: `1px solid ${INK}`, paddingTop: 18, paddingBottom: 22, display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 18 : 20, alignItems: isMobile ? "stretch" : "flex-start" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flex: 1, minWidth: 0 }}>
          <img src={avatarFor(profile)} alt="" style={{ width: avatarSize, height: avatarSize, objectFit: "cover", border: `1px solid ${INK}`, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.title, letterSpacing: "-0.035em", lineHeight: 0.95, margin: 0 }}>
              {profile.name}
              {profile.lastName && <span title="Stored in the system, but not shown to other members" style={{ color: "#9a9a9a", marginLeft: "0.3em", cursor: "help" }}>{profile.lastName}</span>}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ fontFamily: serif, fontSize: TYPE.lg, color: SOFT }}>{profile.pronouns} · {profile.role}</span>
              <Chip title="Your neighborhood">{profile.neighborhood}</Chip>
            </div>
          </div>
        </div>
        <button
          onClick={onEditProfile}
          className={clsx(
            "ink-press inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer",
            "font-sans text-xs tracking-wide uppercase font-bold py-3 px-4.5 border border-ink bg-paper text-ink",
            isMobile ? "self-stretch w-full" : "self-start w-auto"
          )}
        >
          <PencilIcon className="size-3.5" strokeWidth={2.5} />
          Edit profile
        </button>
      </div>

      {/* my neighborhood — one compact panel of stats */}
      <section style={{ padding: "32px 0", borderBottom: `1px solid ${FAINT}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Eyebrow style={{ color: SOFT }}>My neighborhood</Eyebrow>
          <ForwardLink onClick={onOpenNeighbors}>Neighbors</ForwardLink>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 16, marginTop: 14 }}>
          <StatCard value={neighbors.length} label="Neighbors" onClick={onOpenNeighbors} />
          <StatCard value={localOrgs.length} label="Local organizations" onClick={onOpenLocalOrgs} />
          <StatCard value={assemblies.length} label="Upcoming assemblies" onClick={() => setView("events")} />
          <button
            onClick={onPlayGame}
            className="btn-invert btn-teal"
            title="Play the neighbor name game"
            style={{
              aspectRatio: "1 / 1", border: `1px solid ${TEAL}`, background: TEAL, color: PAPER,
              cursor: "pointer",
              display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "stretch",
              padding: 20, width: "100%",
            }}
          >
            <Eyebrow style={{ color: PAPER, fontSize: TYPE.micro, textAlign: "left" }}>Meet My Neighbors</Eyebrow>
            <PlayIcon style={{ width: TYPE.hero, height: TYPE.hero, alignSelf: "flex-end" }} />
          </button>
        </div>
      </section>

      {/* my organizations — speed dial using the same cards as the directory */}
      <section style={{ padding: "32px 0", borderBottom: `1px solid ${FAINT}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Eyebrow style={{ color: SOFT }}>My organizations</Eyebrow>
          <ForwardLink onClick={() => setView("orgs")}>All organizations</ForwardLink>
        </div>
        {myOrgs.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 0, marginTop: 14, borderTop: `1px solid ${INK}`, borderLeft: `1px solid ${INK}` }}>
            {myOrgs.map((o) => (
              <OrgCard key={o.id} o={o} onOpenOrg={onOpenOrg} />
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: serif, fontSize: TYPE.base, color: SOFT, margin: "14px 0 0" }}>
            You’re not a member of any organization yet. Browse the directory to find one.
          </p>
        )}
      </section>

      {/* my events — created or RSVP'd, past and present */}
      <section style={{ padding: "32px 0 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Eyebrow style={{ color: SOFT }}>My events</Eyebrow>
          <ForwardLink onClick={() => setView("events")}>All events</ForwardLink>
        </div>
        <EventFeed
          events={myEvents}
          onOpenEvent={onOpenEvent}
          pageSize={5}
          topBorder
          emptyText="You're not on any events yet. RSVP to one and it'll show up here."
        />
      </section>
    </div>
  );
}
