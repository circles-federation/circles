import { Chip, Eyebrow } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { avatarFor, memberById, MEMBERS } from "@/lib/data";
import { INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";
import { orgDisplayName, orgMembers, orgScope } from "@/lib/orgs.util";

/* Reusable organization card — used in the Organizations directory and the
   Home dashboard's "my organizations" speed dial, so they look identical.
   A Neighborhood Council (org.neighborhood set) displays differently from
   every other org: its bare neighborhood name instead of its full org name,
   no kind eyebrow, and no scope chip (it IS the scope) — Finance/Grounds/
   Community Council are still kind "Council" too but aren't neighborhood-
   rooted, so they render normally. */
export function OrgCard({ o, onOpenOrg }) {
  const { profile, orgs } = useAppState();
  const orgsById = orgs.reduce((acc, org) => { acc[org.id] = org; return acc; }, {});
  const isNeighborhood = !!o.neighborhood;
  const scope = orgScope(o, orgsById);
  const members = orgMembers(o, MEMBERS);

  return (
    <button
      className="ink-press bg-paper"
      onClick={() => onOpenOrg(o)}
      style={{
        textAlign: "left", border: "none",
        borderRight: `1px solid ${INK}`, borderBottom: `1px solid ${INK}`,
        padding: 22, cursor: "pointer", display: "flex", flexDirection: "column",
      }}
    >
      {!isNeighborhood && (
        <div className="flex min-h-[26.5px] items-center justify-between gap-2 mb-3">
          <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>{o.kind}</Eyebrow>
          {scope !== null && (
            <Chip title={scope === profile.neighborhood ? "Local to this neighborhood" : "Across the federation"}>{scope}</Chip>
          )}
        </div>
      )}
      <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.xl, letterSpacing: "-0.025em", lineHeight: 1.0 }}>{orgDisplayName(o)}</div>
      <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: "#222", margin: "10px 0 0", lineHeight: 1.4 }}>{o.tagline}</p>
      <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "flex" }}>
          {members.slice(0, 8).map((id, i) => (
            <img key={id} src={avatarFor(memberById(id))} alt="" style={{ width: 26, height: 26, objectFit: "cover", border: `1px solid ${INK}`, marginLeft: i === 0 ? 0 : -8, background: PAPER }} />
          ))}
        </span>
      </div>
    </button>
  );
}
