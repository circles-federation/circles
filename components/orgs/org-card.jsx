import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Chip } from "@/components/chrome/chip";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { useAppState } from "@/components/providers/app-state-provider";
import { avatarFor, memberById } from "@/lib/data";
import { INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

/* Reusable organization card — used in the Organizations directory and the
   Home dashboard's "my organizations" speed dial, so they look identical. */
export function OrgCard({ o, onOpenOrg }) {
  const { profile } = useAppState();
  return (
    <button
      className="ink-press"
      onClick={() => onOpenOrg(o)}
      style={{
        textAlign: "left", background: PAPER, border: "none",
        borderRight: `1px solid ${INK}`, borderBottom: `1px solid ${INK}`,
        padding: 22, cursor: "pointer", display: "flex", flexDirection: "column", minHeight: 168,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>{o.kind}</Eyebrow>
        <span style={{ marginRight: -6 }}>
          <Chip title={o.level === profile.neighborhood ? "Local to this neighborhood" : "Across the federation"}>{o.level}</Chip>
        </span>
      </div>
      <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.xl, letterSpacing: "-0.025em", lineHeight: 1.0, marginTop: 12 }}>{o.name}</div>
      <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: "#222", margin: "10px 0 0", lineHeight: 1.4 }}>{o.tagline}</p>
      <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ display: "flex" }}>
          {o.members.slice(0, 4).map((id, i) => (
            <img key={id} src={avatarFor(memberById(id))} alt="" style={{ width: 26, height: 26, objectFit: "cover", border: `1px solid ${INK}`, marginLeft: i === 0 ? 0 : -8, background: PAPER }} />
          ))}
        </span>
        <Eyebrow style={{ color: INK, fontSize: TYPE.micro }} className="inline-flex items-center gap-1">
          View
          {/* strokeWidth is in viewBox units, not px — smaller than the
              usual size-3.5/strokeWidth-2.5 pair, so the width is scaled
              up (2.5 * 14/10) to keep the stroke the same physical thickness */}
          <ArrowRightIcon className="size-2.5" strokeWidth={3.5} />
        </Eyebrow>
      </div>
    </button>
  );
}
