import clsx from "clsx";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  // what it turns on and off, for screen readers when no visible label is tied to it
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
}

/* An on/off switch, as in iOS's Settings, in the app's own hard-edged look:
   a square knob in an ink-ruled track, filled ink when on. */
export function Switch({ checked, onChange, label, labelledBy, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer border p-0 transition-colors disabled:cursor-default",
        disabled ? "border-faint bg-paper" : checked ? "border-ink bg-ink" : "border-ink bg-paper"
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "absolute top-0.75 left-0.75 size-5 transition-transform",
          checked && "translate-x-5",
          disabled ? "bg-faint" : checked ? "bg-paper" : "bg-ink"
        )}
      />
    </button>
  );
}
