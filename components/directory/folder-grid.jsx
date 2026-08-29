import { Eyebrow } from "@/components/shared";

// one labeled grid of folder or file cards — shared by CityDirectoryPage's
// and NeighborhoodDirectoryPage's Councils/Organizations/People sections
export function FolderGrid({ label, items, minWidth, renderItem }) {
  return (
    <section>
      <Eyebrow className="text-soft">{label}</Eyebrow>
      <div
        className="mt-3.5 grid border-t border-l border-ink"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minWidth}px), 1fr))` }}
      >
        {items.map(renderItem)}
      </div>
    </section>
  );
}
