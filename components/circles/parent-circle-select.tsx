import { Label, Select } from "@/components/shared";
import { parentCircleOptions } from "@/lib/circles.util";
import type { Circle } from "@/lib/types";

interface ParentCircleSelectProps {
  circles: Circle[];
  value: string;
  onChange: (parentId: string) => void;
  // the circle being edited, which can't be its own parent
  except?: string;
  disabled?: boolean;
}

/* The Parent Circle field, on Create circle and Manage circle: where a circle
   sits. The options are grouped under what they are (Neighborhoods, then
   Citywide) and the city reads as the whole city, since "Providence" alone
   doesn't say whether it's a neighborhood or the city. */
export function ParentCircleSelect({ circles, value, onChange, except, disabled }: ParentCircleSelectProps) {
  const options = parentCircleOptions(circles, except);
  const neighborhoods = options.filter((c) => c.parentId !== null);
  const root = options.find((c) => c.parentId === null);
  return (
    <div>
      <Label htmlFor="circle-parent">Parent Circle</Label>
      <Select id="circle-parent" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="min-[720px]:max-w-90">
        {neighborhoods.length > 0 && (
          <optgroup label="Neighborhoods">
            {neighborhoods.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        )}
        {root && (
          <optgroup label="Citywide">
            <option value={root.id}>{root.name} (the whole city)</option>
          </optgroup>
        )}
      </Select>
      <p className="mt-2 max-w-[42em] font-serif text-sm leading-relaxed text-soft">
        Choosing a neighborhood places this circle inside it. Choosing {root?.name ?? "the city"} makes it citywide.
      </p>
    </div>
  );
}
