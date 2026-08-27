import clsx from "clsx";
import { Chip, Eyebrow } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { avatarFor, memberById, MEMBERS } from "@/lib/data";
import { orgDisplayName, orgMembers, orgScope } from "@/lib/orgs.util";

/* Reusable organization card — used in the Organizations directory and the
   Home dashboard's "my organizations" speed dial, so they look identical.
   A Neighborhood Council (org.neighborhood set) displays differently from
   every other org: its bare neighborhood name instead of its full org name,
   no kind eyebrow, and no scope chip (it IS the scope) — Finance/Grounds/
   Community Council are still kind "Council" too but aren't neighborhood-
   rooted, so they render normally.

   showScopeChip defaults on for flat/mixed-scope lists (Home's "my
   organizations" speed dial) but callers rendering a single org's own
   children (BrowsePage inside a folder, OrgPage's Sub-organizations) pass
   false — every card in such a list structurally shares that folder's own
   scope (orgScope always resolves the whole subtree to the same ancestor),
   so repeating it on each card would be redundant. */
export function OrgCard({ o, onOpenOrg, showScopeChip = true }) {
  const { profile, orgs } = useAppState();
  const orgsById = orgs.reduce((acc, org) => { acc[org.id] = org; return acc; }, {});
  const isNeighborhood = !!o.neighborhood;
  const scope = orgScope(o, orgsById);
  const members = orgMembers(o, MEMBERS);

  return (
    <button
      onClick={() => onOpenOrg(o)}
      className="ink-press bg-paper flex cursor-pointer flex-col border-r border-b border-ink p-5.5 text-left"
    >
      {!isNeighborhood && (
        <div className="mb-3 flex min-h-[26.5px] items-center justify-between gap-2">
          <Eyebrow className="text-soft">{o.kind}</Eyebrow>
          {showScopeChip && scope !== null && (
            <Chip title={scope === profile.neighborhood ? "Local to this neighborhood" : "Across the federation"}>{scope}</Chip>
          )}
        </div>
      )}
      <div className="font-sans text-xl leading-none font-extrabold tracking-[-0.025em]">{orgDisplayName(o)}</div>
      <p className="mt-2.5 font-serif text-sm leading-[1.4] text-[#222]">{o.tagline}</p>
      <div className="mt-auto flex items-center justify-between pt-4">
        <span className="flex">
          {members.slice(0, 8).map((id, i) => (
            <img
              key={id}
              src={avatarFor(memberById(id))}
              alt=""
              className={clsx("h-6.5 w-6.5 border border-ink bg-paper object-cover", i !== 0 && "-ml-2")}
            />
          ))}
        </span>
      </div>
    </button>
  );
}
