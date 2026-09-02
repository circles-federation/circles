import type { ReactNode } from "react";
import { EyebrowGroup } from "./eyebrow-group";

interface FolderGridProps<T> {
  label: string;
  items: T[];
  minWidth: number;
  renderItem: (item: T, index: number, array: T[]) => ReactNode;
}

// one labeled grid of folder or file cards — used by CityDirectoryPage's and
// NeighborhoodDirectoryPage's Councils/Organizations/People sections, and by
// Home's "My circles" speed dial
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
