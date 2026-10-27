import { useId, type ReactNode } from "react";
import { Switch } from "./switch";

// a list of switches (Settings → Notifications, an event's reminders): rows
// under an ink rule, hairlines between them, an ink rule under the last (as
// LinkRow's lists are)
export function SettingRows({ children }: { children: ReactNode }) {
  return <div className="border-t border-ink">{children}</div>;
}

export function RowShell({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-4 border-b border-faint py-4 last:border-b-ink">{children}</div>;
}

export function SettingRow({ label, detail, checked, onChange, disabled }: { label: string; detail?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <RowShell>
      <div className="min-w-0 flex-1">
        <div id={id} className="font-sans text-base font-bold">
          {label}
        </div>
        {detail && <div className="mt-0.5 font-serif text-sm leading-snug text-soft">{detail}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} labelledBy={id} disabled={disabled} />
    </RowShell>
  );
}
