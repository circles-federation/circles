"use client";

import { useState } from "react";
import { BackButton } from "@/components/shared/back-button";
import { Eyebrow } from "@/components/shared/eyebrow";
import { useAppState } from "@/components/providers/app-state-provider";
import { MEMBERS, avatarFor } from "@/lib/data";
import { FAINT, INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRounds(homeHood, excludeId) {
  // the game is for learning your direct neighbors, so it draws only from the
  // player's own neighborhood, minus the player themselves — you already know who you are
  const neighbors = MEMBERS.filter((m) => m.neighborhood === homeHood && m.id !== excludeId);
  const pool = shuffle(neighbors);
  return pool.map((person) => {
    const distractors = shuffle(neighbors.filter((m) => m.id !== person.id)).slice(0, 3);
    const options = shuffle([person, ...distractors]).map((m) => m.name);
    return { person, options };
  });
}

const primaryBtn = {
  marginTop: 28, fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.14em", textTransform: "uppercase",
  fontWeight: 700, background: INK, color: PAPER, border: `1px solid ${INK}`,
  padding: "14px 24px", cursor: "pointer",
};

export function NameGame({ onExit }) {
  const { profile } = useAppState();
  const [rounds, setRounds] = useState(() => buildRounds(profile.neighborhood, profile.id));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const round = rounds[idx];
  const answered = picked !== null;

  function choose(name) {
    if (answered) return;
    setPicked(name);
    if (name === round.person.name) setScore((s) => s + 1);
  }

  function next() {
    if (idx + 1 >= rounds.length) {
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setPicked(null);
  }

  function restart() {
    setRounds(buildRounds(profile.neighborhood, profile.id));
    setIdx(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  }

  if (done) {
    const pct = Math.round((score / rounds.length) * 100);
    return (
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px 64px" }}>
        <BackButton onClick={onExit}>Home</BackButton>
        <Eyebrow style={{ color: SOFT, display: "block", marginTop: 28 }}>Round complete</Eyebrow>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.hero, letterSpacing: "-0.04em", lineHeight: 0.9, marginTop: 14 }}>
          {score}<span style={{ color: FAINT }}>/{rounds.length}</span>
        </div>
        <p style={{ fontFamily: serif, fontSize: TYPE.lg, marginTop: 18, maxWidth: "32em", lineHeight: 1.5 }}>
          You named {score} of your {rounds.length} neighbors — {pct}%. Knowing each other by name is the
          smallest unit of solidarity. Run it again whenever new neighbors join.
        </p>
        <div style={{ display: "flex", gap: 0, marginTop: 28 }}>
          <button onClick={restart} style={{ ...primaryBtn, marginTop: 0 }}>Play again</button>
          <button
            onClick={onExit}
            style={{
              fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.14em", textTransform: "uppercase",
              fontWeight: 700, background: PAPER, color: INK, border: `1px solid ${INK}`, borderLeft: "none",
              padding: "14px 24px", cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const m = round.person;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px 64px" }}>
      <BackButton onClick={onExit} className="mb-4">Home</BackButton>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${INK}`, paddingBottom: 11 }}>
        <Eyebrow>Who is this?</Eyebrow>
        <span style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.xs, letterSpacing: "0.08em" }}>
          {String(idx + 1).padStart(2, "0")} / {rounds.length} · Score {score}
        </span>
      </div>

      <div style={{ height: 2, background: FAINT, marginTop: -1 }}>
        <div style={{ height: 2, background: INK, width: `${((idx) / rounds.length) * 100}%`, transition: "width .3s" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 36 }}>
        <div style={{ position: "relative" }}>
          <img
            key={m.id}
            src={avatarFor(m)}
            alt="A neighbor in the federation"
            style={{ width: 240, height: 240, objectFit: "cover", border: `1px solid ${INK}`, display: "block" }}
          />
          <div style={{
            position: "absolute", top: -16, left: -16, width: 40, height: 40, borderRadius: "50%",
            border: `1px solid ${INK}`, background: PAPER, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: serif, fontSize: TYPE.xl, fontWeight: 700,
          }}>?</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginTop: 36, border: `1px solid ${INK}` }}>
        {round.options.map((name, i) => {
          const isCorrect = name === m.name;
          const isPicked = name === picked;
          let bg = PAPER, color = INK;
          if (answered && isCorrect) { bg = INK; color = PAPER; }
          else if (answered && isPicked && !isCorrect) { bg = PAPER; color = SOFT; }
          return (
            <button
              key={name}
              onClick={() => choose(name)}
              disabled={answered}
              style={{
                fontFamily: sans, fontSize: TYPE.lg, fontWeight: 700, letterSpacing: "0.01em",
                padding: "22px 16px", cursor: answered ? "default" : "pointer",
                background: bg, color,
                border: "none",
                borderRight: i % 2 === 0 ? `1px solid ${INK}` : "none",
                borderTop: i >= 2 ? `1px solid ${INK}` : "none",
                textAlign: "left", position: "relative",
                transition: "background .15s",
              }}
            >
              {name}
              {answered && isCorrect && <span style={{ position: "absolute", right: 16, fontFamily: serif }}>✓</span>}
              {answered && isPicked && !isCorrect && <span style={{ position: "absolute", right: 16, fontFamily: serif }}>✕</span>}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 28, minHeight: 60 }}>
        {answered && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
            <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT, margin: 0, lineHeight: 1.45 }}>
              {picked === m.name ? "Right — " : `That's ${m.name}. `}
              <span style={{ color: INK }}>{m.name}</span> · {m.role}, {m.pronouns}.
            </p>
            <button onClick={next} style={{ ...primaryBtn, marginTop: 0, flexShrink: 0 }}>
              {idx + 1 >= rounds.length ? "See score" : "Next"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
