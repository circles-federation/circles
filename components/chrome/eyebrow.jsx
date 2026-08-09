import clsx from "clsx";

export function Eyebrow({ children, style, className }) {
  // enforce a legible minimum: ignore any fontSize override below 11px
  const merged = { ...style };
  if (typeof merged.fontSize === "number" && merged.fontSize < 11) delete merged.fontSize;
  return (
    <span
      className={clsx("font-sans text-eyebrow tracking-[0.2em] uppercase font-bold", className)}
      style={merged}
    >
      {children}
    </span>
  );
}
