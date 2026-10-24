"use client";

import { RichSelect } from "@/components/shared/rich-select";
import type { ResourceIcon } from "@/lib/types";
import { RESOURCE_ICONS, RESOURCE_ICON_TEXT, RESOURCE_OPTIONS } from "./resource-kinds";

interface ResourceKindPickerProps {
  id?: string;
  value: ResourceIcon;
  onChange: (kind: ResourceIcon) => void;
  // who an announcement is for, in its hint ("members", "neighbors")
  audience: string;
}

/* What a bulletin item is, each kind shown as the board will: its icon in
   its color, its name, and a line on what it's for. */
export function ResourceKindPicker({ id, value, onChange, audience }: ResourceKindPickerProps) {
  return (
    <RichSelect
      {...(id ? { id } : {})}
      label="What are you adding?"
      value={value}
      onChange={onChange}
      options={RESOURCE_OPTIONS.map((o) => ({
        value: o.key,
        label: o.label,
        hint: o.key === "announcement" ? `A message for ${audience}` : o.hint,
        icon: RESOURCE_ICONS[o.key],
        iconClassName: RESOURCE_ICON_TEXT[o.key],
      }))}
    />
  );
}
