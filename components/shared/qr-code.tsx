import { useMemo } from "react";
import QRCode from "qrcode";

// the blank margin a scanner needs around the code, in modules
const QUIET_ZONE = 4;

/* A QR code for `value`, drawn as one SVG path in the current text colour, so
   it stays sharp at any size and prints as crisply as it shows. Error
   correction M copes with a crease or a smudge on a printed poster. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    let d = "";
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) if (modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
    }
    return { size: modules.size, path: d };
  }, [value]);

  return (
    <svg
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${size + QUIET_ZONE * 2} ${size + QUIET_ZONE * 2}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
