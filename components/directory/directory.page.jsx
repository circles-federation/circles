"use client";

import { useMemo, useState } from "react";
import { Chip } from "@/components/chrome/chip";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { PageHeader } from "@/components/chrome/page-header";
import { SearchWithFilter } from "@/components/chrome/search-with-filter";
import { CURRENT_USER_ID, MEMBERS, ORGS_BY_MEMBER, avatarFor } from "@/lib/data";
import { INK, PAPER, SOFT, TYPE, sans } from "@/lib/theme";

export function Directory({ onOpenMember, initialHood = null }) {
  const [query, setQuery] = useState("");
  const [hood, setHood] = useState(initialHood);
  const hoods = [...new Set(MEMBERS.map((m) => m.neighborhood))].sort();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MEMBERS.filter((m) => {
      if (hood && m.neighborhood !== hood) return false;
      if (!q) return true;
      return [m.name, m.role, ...m.skills, ...m.interests, m.neighborhood, ...ORGS_BY_MEMBER[m.id].map((o) => o.name)]
        .join(" ").toLowerCase().includes(q);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [query, hood]);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 80px" }}>
      <PageHeader title="People">
        <span style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.xs, letterSpacing: "0.08em" }}>{filtered.length} shown</span>
      </PageHeader>

      <SearchWithFilter
        query={query}
        onQuery={setQuery}
        placeholder="Search a name, skill, interest, or organization"
        filters={[
          { label: "Neighborhood", options: hoods, active: hood, onFilter: setHood },
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))", gap: 0, marginTop: 28, borderTop: `1px solid ${INK}`, borderLeft: `1px solid ${INK}` }}>
        {filtered.map((m) => (
          <button
            key={m.id}
            className="ink-press"
            onClick={() => onOpenMember(m)}
            style={{
              textAlign: "left", background: PAPER, border: "none",
              borderRight: `1px solid ${INK}`, borderBottom: `1px solid ${INK}`,
              padding: 18, cursor: "pointer", display: "flex", gap: 14, alignItems: "center",
            }}
          >
            <img src={avatarFor(m)} alt="" style={{ width: 56, height: 56, objectFit: "cover", filter: "grayscale(100%)", border: `1px solid ${INK}`, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.base, letterSpacing: "-0.01em" }}>
                {m.name}
                {m.id === CURRENT_USER_ID && <span style={{ color: SOFT, fontWeight: 600 }}> (you)</span>}
              </div>
              <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>{m.role}</Eyebrow>
              <div style={{ marginTop: 7 }}>
                <Chip title={`Neighborhood: ${m.neighborhood}`}>{m.neighborhood}</Chip>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
