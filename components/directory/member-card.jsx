import { Chip, Eyebrow } from "@/components/shared";
import { avatarFor } from "@/lib/data";
import { INK, PAPER, SOFT, TYPE, sans } from "@/lib/theme";

/* A "file" in the directory hierarchy — a person, who (unlike an org) never
   nests. Reusable card, used anywhere a flat member list is shown. */
export function MemberCard({ m, profile, onOpenMember }) {
  return (
    <button
      className="ink-press"
      onClick={() => onOpenMember(m)}
      style={{
        textAlign: "left", background: PAPER, border: "none",
        borderRight: `1px solid ${INK}`, borderBottom: `1px solid ${INK}`,
        padding: 18, cursor: "pointer", display: "flex", gap: 14, alignItems: "center",
      }}
    >
      <img src={avatarFor(m)} alt="" style={{ width: 56, height: 56, objectFit: "cover", border: `1px solid ${INK}`, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.base, letterSpacing: "-0.01em" }}>
          {m.name}
          {m.id === profile.id && <span style={{ color: SOFT, fontWeight: 600 }}> (you)</span>}
        </div>
        <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>{m.role}</Eyebrow>
        <div style={{ marginTop: 7 }}>
          <Chip title={`Neighborhood: ${m.neighborhood}`}>{m.neighborhood}</Chip>
        </div>
      </div>
    </button>
  );
}
