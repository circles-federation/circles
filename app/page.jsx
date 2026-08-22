"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UsersIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Eyebrow, fieldInput, fieldLabel, FloatingActionButton, useToast } from "@/components/shared";
import { requestLoginCode, verifyLoginCode } from "@/lib/auth";
import { MEMBERS } from "@/lib/data";
import { FAINT, INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

const submitButton = {
  marginTop: 16, width: "100%",
  fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
  padding: "13px 24px", border: `1px solid ${INK}`, background: INK, color: PAPER,
};

// only members with an email can actually be signed in as — see lib/db/members.js's getMemberByEmail
const DEMO_MEMBERS = MEMBERS.filter((m) => m.email).sort((a, b) => a.name.localeCompare(b.name));

/* The unauthenticated welcome page — passwordless email + one-time-code
   login. No real email provider yet, so requestLoginCode() hands the code
   straight back and it's shown here as an explicit "dev mode" hint; the
   Server Actions themselves never navigate (matching this app's existing
   convention that mutators are pure state, callers do the routing) — this
   form calls router.push() itself once verifyLoginCode() succeeds.

   The floating "Demo accounts" button is dev/demo scaffolding, not a real
   product feature — it exists so someone showing the app off knows which
   emails are actually signed-in-able, since there's no real account list to
   check against yet. */
export default function WelcomePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState("email"); // "email" | "code"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  async function handleSendCode(e) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    const result = await requestLoginCode(email);
    setBusy(false);
    if (!result.ok) {
      showToast({ tone: "error", title: "Couldn't send a code", message: result.error });
      return;
    }
    setDevCode(result.code);
    setStep("code");
  }

  async function handleVerify(e) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    const result = await verifyLoginCode(email, code);
    setBusy(false);
    if (!result.ok) {
      showToast({ tone: "error", title: "Couldn't verify that code", message: result.error });
      return;
    }
    router.push("/home");
  }

  function useDifferentEmail() {
    setStep("email");
    setCode("");
    setDevCode(null);
  }

  function selectDemoMember(m) {
    setEmail(m.email);
    setCode("");
    setDevCode(null);
    setStep("email");
    setDemoOpen(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16" style={{ background: PAPER }}>
      <div className="w-full max-w-md">
        <div style={{ borderTop: `3px solid ${INK}`, paddingTop: 18 }}>
          <Eyebrow style={{ color: SOFT }}>Welcome to</Eyebrow>
          <h1 style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.hero, letterSpacing: "-0.04em", lineHeight: 0.9, margin: "12px 0 0" }}>
            Providence
          </h1>
          <p style={{ fontFamily: serif, fontSize: TYPE.lg, color: "#222", margin: "14px 0 28px", lineHeight: 1.5 }}>
            A federation of neighborhoods, organizations, and assemblies. Sign in with your email to get to your neighborhood.
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendCode}>
            <label style={fieldLabel}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@duck.com"
              style={fieldInput}
              autoFocus
              required
            />
            <button type="submit" disabled={busy} className="btn-invert btn-ink" style={{ ...submitButton, cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT, margin: "0 0 16px" }}>
              We sent a code to <strong style={{ color: INK }}>{email}</strong>.
            </p>
            {devCode && (
              <div style={{ border: `1px dashed ${SOFT}`, padding: "10px 12px", marginBottom: 16, fontFamily: sans, fontSize: TYPE.sm, color: SOFT }}>
                Dev mode — there&apos;s no real email provider yet, so here&apos;s your code:{" "}
                <strong style={{ color: INK, letterSpacing: "0.08em" }}>{devCode}</strong>
              </div>
            )}
            <label style={fieldLabel}>One-time code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              style={{ ...fieldInput, letterSpacing: "0.2em" }}
              autoFocus
              inputMode="numeric"
              required
            />
            <button type="submit" disabled={busy} className="btn-invert btn-ink" style={{ ...submitButton, cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={useDifferentEmail}
              className="ink-press"
              style={{ ...submitButton, marginTop: 12, cursor: "pointer", background: PAPER, color: INK }}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>

      <FloatingActionButton
        onClick={() => setDemoOpen(true)}
        title="Demo accounts"
        icon={<UsersIcon className="size-5" strokeWidth={2} style={{ color: INK }} />}
      />

      {demoOpen && (
        <div
          onClick={() => setDemoOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px", zIndex: 100, overflowY: "auto" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: PAPER, border: `1px solid ${INK}`, maxWidth: 440, width: "100%", boxShadow: "8px 8px 0 rgba(10,10,10,1)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${INK}`, padding: "12px 18px" }}>
              <div>
                <Eyebrow style={{ color: SOFT }}>Demo accounts</Eyebrow>
                <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT, margin: "4px 0 0" }}>Tap a name to fill in their email.</p>
              </div>
              <button onClick={() => setDemoOpen(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, marginLeft: 12 }}>
                <XMarkIcon className="size-5" strokeWidth={2} style={{ color: INK }} />
              </button>
            </div>
            <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {DEMO_MEMBERS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => selectDemoMember(m)}
                  className="ink-press"
                  style={{
                    width: "100%", textAlign: "left", background: PAPER, border: "none",
                    borderBottom: `1px solid ${FAINT}`, padding: "12px 18px", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
                  }}
                >
                  <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.sm, whiteSpace: "nowrap" }}>{m.name}</span>
                  <span style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT, overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
