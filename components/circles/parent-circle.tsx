import { FolderGrid } from "@/components/shared";
import { CircleCard } from "./circle-card";
import { useCirclesById } from "@/lib/hooks";
import type { Circle } from "@/lib/types";

interface ParentCircleProps {
  circle: Circle;
  onOpenCircle: (c: Circle) => void;
}

/* The neighborhood's parent (the city), as a one-card folder grid — the same
   shape NeighborhoodPage uses for its children. CirclePage, which has a
   masthead, shows its parent as a chip there instead. The kind
   eyebrow is forced on (a neighborhood card hides it by default) since the
   "Part of" label doesn't say what the parent is — except for the city root,
   whose type is just the generic "other". */
export function ParentCircle({ circle, onOpenCircle }: ParentCircleProps) {
  const byId = useCirclesById();
  const parent = circle.parentId !== null ? byId[circle.parentId] : undefined;
  if (!parent) return null;

  return (
    <FolderGrid
      label="Part of"
      items={[parent]}
      minWidth={300}
      renderItem={(p) => (
        <CircleCard key={p.id} c={p} onOpenCircle={onOpenCircle} showNeighborhoodChip={false} showKindEyebrow={p.parentId !== null} />
      )}
    />
  );
}
