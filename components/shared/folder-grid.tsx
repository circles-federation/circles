import type { ReactNode } from "react";
import { EyebrowGroup } from "./eyebrow-group";

interface FolderGridProps<T> {
  label: ReactNode;
  items: T[];
  minWidth: number;
  renderItem: (item: T, index: number, array: T[]) => ReactNode;
}

// one labeled grid of folder or file cards — used by CirclesRootPage's and
// NeighborhoodPage's Circles/Organizations/People sections, and a profile's
// Member of
export function FolderGrid<T>({ label, items, minWidth, renderItem }: FolderGridProps<T>) {
  return (
    <section>
      <EyebrowGroup label={label}>
        <div
          className="grid border-t border-l border-ink"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minWidth}px), 1fr))` }}
        >
          {items.map(renderItem)}
        </div>
      </EyebrowGroup>
    </section>
  );
}
