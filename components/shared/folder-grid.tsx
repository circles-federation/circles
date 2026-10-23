import type { ReactNode } from "react";
import { Eyebrow } from "./eyebrow";
import { EyebrowGroup } from "./eyebrow-group";

interface FolderGridProps<T> {
  label: ReactNode;
  items: T[];
  minWidth: number;
  renderItem: (item: T, index: number, array: T[]) => ReactNode;
  // something to do with the whole grid, at the right of its label (a
  // neighborhood's People: Learn names)
  action?: ReactNode;
}

// one labeled grid of folder or file cards — used by CirclesRootPage's and
// NeighborhoodPage's Circles/Organizations/People sections, and a profile's
// Member of
export function FolderGrid<T>({ label, items, minWidth, renderItem, action }: FolderGridProps<T>) {
  const grid = (
    <div
      className="grid border-t border-l border-ink"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minWidth}px), 1fr))` }}
    >
      {items.map(renderItem)}
    </div>
  );
  return (
    <section>
      {action ? (
        <>
          {/* the action is taller than the label, so the two share its bottom edge */}
          <div className="mb-3 flex items-end justify-between gap-4">
            <Eyebrow className="text-soft">{label}</Eyebrow>
            {action}
          </div>
          {grid}
        </>
      ) : (
        <EyebrowGroup label={label}>{grid}</EyebrowGroup>
      )}
    </section>
  );
}
