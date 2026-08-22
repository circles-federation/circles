"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/chrome/page-header";
import { SearchWithFilter } from "@/components/chrome/search-with-filter";
import { OrgCard } from "./org-card";
import { INK, TYPE, sans } from "@/lib/theme";

export function OrgDirectory({ orgs, onOpenOrg, initialLevel = null }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState(initialLevel);
  // neighborhoods first (sorted), then Providence (the federation level) last
  const levels = (() => {
    const all = [...new Set(orgs.map((o) => o.level))];
    const hoods = all.filter((l) => l !== "Providence").sort();
    return all.includes("Providence") ? [...hoods, "Providence"] : hoods;
  })();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orgs.filter((o) => {
      if (level && o.level !== level) return false;
      if (!q) return true;
      return [o.name, o.kind, o.tagline, o.level, ...o.offers].join(" ").toLowerCase().includes(q);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [orgs, query, level]);

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
