"use client";

import { useEffect } from "react";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Chip } from "@/components/chrome/chip";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { Tag } from "@/components/chrome/tag";
import { HOME_HOOD, ORGS_BY_MEMBER, avatarFor } from "@/lib/data";
import { FAINT, INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

export function ProfileModal({ member: m, onClose, onOpenOrg }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const orgs = ORGS_BY_MEMBER[m.id] || [];

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px", zIndex: 100, overflowY: "auto" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: PAPER, border: `1px solid ${INK}`, maxWidth: 560, width: "100%", boxShadow: "8px 8px 0 rgba(10,10,10,1)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${INK}`, padding: "12px 18px" }}>
          <Eyebrow style={{ color: SOFT }}>Profile</Eyebrow>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: sans, fontSize: TYPE.lg, fontWeight: 700, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 20, padding: 22, borderBottom: `1px solid ${FAINT}` }}>
          <img src={avatarFor(m)} alt="" style={{ width: 110, height: 110, objectFit: "cover", filter: "grayscale(100%)", border: `1px solid ${INK}`, flexShrink: 0 }} />
          <div>
            <h2 style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.heading, letterSpacing: "-0.03em", lineHeight: 0.95, margin: 0 }}>{m.name}</h2>
            <p style={{ fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.04em", color: SOFT, marginTop: 6 }}>{m.pronouns}</p>
            <div style={{ marginTop: 10 }}><Tag filled>{m.role}</Tag></div>
          </div>
        </div>

        <div style={{ padding: 22 }}>
          <p style={{ fontFamily: serif, fontSize: TYPE.lg, lineHeight: 1.5, margin: "0 0 22px" }}>{m.bio}</p>

          {m.email && (
            <>
              <Eyebrow style={{ color: SOFT }}>Get in touch</Eyebrow>
              <div style={{ marginTop: 10, marginBottom: 22 }}>
                <a
                  href={`mailto:${m.email}`}
                  style={{
                    fontFamily: sans, fontSize: TYPE.sm, fontWeight: 700, color: INK, textDecoration: "none",
                    display: "inline-flex", alignItems: "center", gap: 8,
                    border: `1px solid ${INK}`, padding: "9px 13px", wordBreak: "break-all",
                  }}
                >
                  <span style={{ fontSize: TYPE.eyebrow }}>✉</span>
                  {m.email}
                </a>
              </div>
            </>
          )}

          <Eyebrow style={{ color: SOFT }}>Skills offered</Eyebrow>
          <div style={{ marginTop: 10, marginBottom: 22 }}>
            {m.skills.map((s) => <Tag key={s}>{s}</Tag>)}
          </div>

          <Eyebrow style={{ color: SOFT }}>Interests</Eyebrow>
          <div style={{ marginTop: 10, marginBottom: 22 }}>
            {m.interests.map((s) => <Tag key={s}>{s}</Tag>)}
          </div>

          <Eyebrow style={{ color: SOFT }}>Neighborhood</Eyebrow>
          <div style={{ marginTop: 12, marginBottom: orgs.length ? 22 : 0, display: "flex", flexWrap: "wrap", gap: 0 }}>
            <Chip title={m.neighborhood === HOME_HOOD ? "This neighborhood" : "Another neighborhood in the federation"}>{m.neighborhood}</Chip>
          </div>

          {orgs.length > 0 && (
            <>
              <Eyebrow style={{ color: SOFT }}>Member of</Eyebrow>
              <div style={{ marginTop: 12, borderTop: `1px solid ${INK}` }}>
                {orgs.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => onOpenOrg(o)}
                    style={{
                      width: "100%", textAlign: "left", background: PAPER, border: "none",
                      borderBottom: `1px solid ${FAINT}`, padding: "12px 0", cursor: "pointer",
                      display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    }}
                  >
                    <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.sm }}>{o.name}</span>
                    <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }} className="inline-flex items-center gap-1">
                      {o.kind}
                      {/* strokeWidth is in viewBox units, not px — smaller than the
                          usual size-3.5/strokeWidth-2.5 pair, so the width is scaled
                          up (2.5 * 14/10) to keep the stroke the same physical thickness */}
                      <ArrowRightIcon className="size-2.5" strokeWidth={3.5} />
                    </Eyebrow>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
