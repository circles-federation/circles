import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* The design's contrast promises, checked against the tokens themselves
   (app/globals.css for Sol, app/themes/luna.css for Luna), so a retuned colour
   can't quietly bring back small text that can't be read. */

function tokens(file: string, block: RegExp): Record<string, string> {
  const css = fs.readFileSync(path.join(import.meta.dirname, "..", file), "utf8");
  const body = css.match(block)?.[1] ?? "";
  return Object.fromEntries([...body.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!]));
}

const SOL = tokens("app/globals.css", /@theme\s*\{([\s\S]*?)\n\}/);
const LUNA = { ...SOL, ...tokens("app/themes/luna.css", /\[data-theme="luna"\]\s*\{([\s\S]*?)\n  \}/) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// [text, ground, minimum]: 4.5 for small text
const PAIRS: [string, string, number][] = [
  ["ink", "page", 4.5],
  ["ink", "paper", 4.5],
  ["body", "paper", 4.5],
  ["soft", "paper", 4.5],
  ["soft", "wash", 4.5],
  ["soft", "page", 4.5],
  ["flame-text", "paper", 4.5],
  ["flame-text", "page", 4.5],
  ["on-action", "action", 4.5],
  ["on-action", "flame", 4.5],
  ["on-action", "tint-leaf", 4.5],
  ["on-action", "tint-warn", 4.5],
  ["on-action", "tint-danger", 4.5],
  ["paper", "teal", 4.5],
];

describe.each([["Sol", SOL], ["Luna", LUNA]] as const)("%s contrast", (_name, t) => {
  it.each(PAIRS)("%s on %s is at least %d:1", (fg, bg, min) => {
    const [a, b] = [t[fg], t[bg]];
    expect(a, `--color-${fg}`).toBeDefined();
    expect(b, `--color-${bg}`).toBeDefined();
    expect(ratio(a!, b!)).toBeGreaterThanOrEqual(min);
  });
});
