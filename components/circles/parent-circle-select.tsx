"use client";

import { useMemo } from "react";
import { FederationExplorerField, Label, useFederationExplorer } from "@/components/shared";
import { indexCircles, parentCircleRefusal } from "@/lib/circles.util";
import type { Circle } from "@/lib/types";

interface ParentExplorerOptions {
  circles: Circle[];
  value: string;
  onChange: (parentId: string) => void;
  // the circle being edited, which can't go inside itself
  except?: string;
}

/* The Federation Explorer for a circle's parent: every circle the member can
   see is there to browse, but only a neighborhood or the city can be chosen
   (parentCircleRefusal, the rule parentCircleOptions holds the server to).
   The form holding the field uses it as useFederationExplorer says. */
export function useParentCircleExplorer({ circles, value, onChange, except }: ParentExplorerOptions) {
  const byId = useMemo(() => indexCircles(circles), [circles]);
  return useFederationExplorer({ title: "Parent circle", circles, value: value || null, onChange, refusal: (c) => parentCircleRefusal(c, byId, except) });
}

interface ParentCircleSelectProps {
  circles: Circle[];
  value: string;
  // opens useParentCircleExplorer
  onOpen: () => void;
  disabled?: boolean;
}

// The Parent Circle field, on Create circle and Manage circle: where a circle sits
export function ParentCircleSelect({ circles, value, onOpen, disabled }: ParentCircleSelectProps) {
  const root = circles.find((c) => c.parentId === null);
  return (
    <div>
      <Label htmlFor="circle-parent">Parent Circle</Label>
      <div className="min-[720px]:max-w-90">
        <FederationExplorerField id="circle-parent" circles={circles} value={value || null} onOpen={onOpen} disabled={disabled} />
      </div>
      <p className="mt-2 max-w-[42em] font-serif text-sm leading-relaxed text-soft">
        Choosing a neighborhood places this circle inside it. Choosing {root?.name ?? "the city"} makes it citywide.
      </p>
    </div>
  );
}
