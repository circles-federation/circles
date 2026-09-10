import clsx from "clsx";
import { HomeIcon } from "@heroicons/react/24/outline";
import { Avatar, Chip, Eyebrow } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { useMemberById, useMembers } from "@/lib/hooks";
import { orgDisplayName, orgMembers, orgScope } from "@/lib/orgs.util";
import type { Org } from "@/lib/types";

interface OrgCardProps {
  o: Org;
  onOpenOrg: (o: Org) => void;
  showScopeChip?: boolean;
  showKindEyebrow?: boolean;
}

/* Reusable organization card — used in the Organizations directory and the
   Home dashboard's "my organizations" speed dial, so they look identical.
   A Neighborhood Council (org.neighborhood set) displays differently from
   every other org: its bare neighborhood name instead of its full org name
   and no scope chip (it IS the scope) — Finance/Grounds/Community Council
   are still kind "Council" too but aren't neighborhood-rooted, so they
   render normally. The viewer's own home neighborhood card also gets a
   small teal home icon next to its title (matching NeighborhoodDirectoryPage's
   page-title treatment when browsing inside that same folder).

   showScopeChip defaults on for flat/mixed-scope lists (Home's "my
   organizations" speed dial, CityDirectoryPage) but callers rendering a
   single org's own children (NeighborhoodDirectoryPage, OrgPage's
   Sub-organizations) pass false — every card in such a list structurally
   shares that folder's own scope (orgScope always resolves the whole
   subtree to the same ancestor), so repeating it on each card would be
   redundant.

   showKindEyebrow controls the "Neighborhood"/kind eyebrow and defaults to
   the opposite of isNeighborhood — on for a normal org, off for a
   Neighborhood Council — matching the plain Organizations directory. But
   any caller can override in either direction when its own grid label
   already says what the eyebrow would: NeighborhoodDirectoryPage's Councils
   grid passes false even for non-neighborhood cards (Finance/Grounds/Community),
   since "Councils" is right there in the section header; Home's speed dial
   passes true for its neighborhood card, since that's a single flat,
   mixed-kind list with no grid label to lean on. */
export function OrgCard({ o, onOpenOrg, showScopeChip = true, showKindEyebrow = !o.neighborhood }: OrgCardProps) {
  const { profile, orgs } = useAppState();
  const allMembers = useMembers();
  const memberById = useMemberById();
  const orgsById = orgs.reduce<Record<string, Org>>((acc, org) => { acc[org.id] = org; return acc; }, {});
  const isNeighborhood = !!o.neighborhood;
  const isHome = isNeighborhood && o.neighborhood === profile.neighborhood;
  const scope = orgScope(o, orgsById);
  const members = orgMembers(o, allMembers);

  return (
    <button
      onClick={() => onOpenOrg(o)}
      className="ink-press bg-paper flex cursor-pointer flex-col border-r border-b border-ink p-5.5 text-left"
    >
      {showKindEyebrow && (
        <div className="mb-3 flex min-h-[26.5px] items-center justify-between gap-2">
          <Eyebrow className="text-soft">{isNeighborhood ? "Neighborhood" : o.kind}</Eyebrow>
          {!isNeighborhood && showScopeChip && scope !== null && (
            <Chip title={scope === profile.neighborhood ? "Local to this neighborhood" : "Across the federation"}>{scope}</Chip>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 font-sans text-xl leading-none font-extrabold tracking-[-0.025em]">
        {orgDisplayName(o)}
        {isHome && <HomeIcon className="size-5 shrink-0 text-teal" strokeWidth={2} />}
      </div>
      <p className="mt-2.5 font-serif text-sm leading-[1.4] text-[#222]">{o.tagline}</p>
      <div className="mt-auto flex items-center justify-between pt-4">
        <span className="flex">
          {/* member ids returned by orgMembers always resolve — internal
              seed-data invariant, not a runtime possibility to guard */}
          {members.slice(0, 8).map((id, i) => (
            <Avatar key={id} member={memberById(id)!} size={26} className={clsx(i !== 0 && "-ml-2")} />
          ))}
        </span>
      </div>
    </button>
  );
}
