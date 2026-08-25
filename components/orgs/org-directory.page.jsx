"use client";

import { useMemo, useState } from "react";
import { PageHeader, SearchWithFilter } from "@/components/shared";
import { OrgCard } from "./org-card";
import { orgScope } from "@/lib/orgs.util";
import { INK, TYPE, sans } from "@/lib/theme";

// orgScope() returns null for a root/federation-wide org — displayed as
// "Providence" here, matching the old level field's literal value.
function scopeLabel(o, orgsById) {
  return orgScope(o, orgsById) ?? "Providence";
}

export function OrgDirectory({ orgs, onOpenOrg, initialLevel = null }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState(initialLevel);
  const orgsById = orgs.reduce((acc, o) => { acc[o.id] = o; return acc; }, {});
  // neighborhoods first (sorted), then Providence (the federation level) last
  const levels = (() => {
    const all = [...new Set(orgs.map((o) => scopeLabel(o, orgsById)))];
    const hoods = all.filter((l) => l !== "Providence").sort();
    return all.includes("Providence") ? [...hoods, "Providence"] : hoods;
  })();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orgs.filter((o) => {
      const scope = scopeLabel(o, orgsById);
      if (level && scope !== level) return false;
      if (!q) return true;
      return [o.name, o.kind, o.tagline, scope, ...o.offers].join(" ").toLowerCase().includes(q);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [orgs, orgsById, query, level]);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 80px" }}>
      <PageHeader title="Organizations">
        <span style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.xs, letterSpacing: "0.08em" }}>{filtered.length} shown</span>
      </PageHeader>

      <SearchWithFilter
        query={query}
        onQuery={setQuery}
        placeholder="Search a name, kind, or what they offer"
        filters={[
          { label: "Level", options: levels, active: level, onFilter: setLevel },
        ]}
      />


      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 0, marginTop: 28, borderTop: `1px solid ${INK}`, borderLeft: `1px solid ${INK}` }}>
        {filtered.map((o) => (
          <OrgCard key={o.id} o={o} onOpenOrg={onOpenOrg} />
        ))}
      </div>
    </div>
  );
}
