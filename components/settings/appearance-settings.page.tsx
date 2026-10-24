"use client";

import { CheckIcon } from "@heroicons/react/24/outline";
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";
import type { ComponentType, SVGProps } from "react";
import clsx from "clsx";
import { PageContainer } from "@/components/shared";
import { setThemeChoice, useTheme } from "@/lib/theme";
import { DARK_THEME, LIGHT_THEME, THEMES, themeByKey, type ThemeChoice, type ThemeKey } from "@/lib/themes.util";

// each theme's mark, on its preview: a new theme needs one here
const THEME_ICON: Record<ThemeKey, ComponentType<SVGProps<SVGSVGElement>>> = { sol: SunIcon, luna: MoonIcon };

/* Settings → Appearance: how Circles looks on this device. Automatic (the
   device's own light or dark setting, which a new device starts on), then
   each theme, a preview of each to compare. A tap applies it at once, the
   one setting with no Save, as on iOS: seeing it is how it's judged. */
export function AppearanceSettingsPage() {
  const current = useTheme();
  const choices: { key: ThemeChoice; label: string; description: string }[] = [
    { key: "auto", label: "Automatic", description: `${themeByKey(LIGHT_THEME).label} by day, ${themeByKey(DARK_THEME).label} while your device is in dark mode.` },
    ...THEMES.map((t) => ({ key: t.key, label: t.label, description: t.description })),
  ];

  return (
    <PageContainer size="normal">
      <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-3 min-[720px]:max-w-150 min-[720px]:gap-5">
        {choices.map((c) => {
          const on = current?.choice === c.key;
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setThemeChoice(c.key)}
              className="group flex cursor-pointer flex-col items-center gap-3 border-0 bg-transparent p-0 text-center"
            >
              {/* outlined in ink while chosen, as iOS outlines its choice */}
              <span className={clsx("block w-full p-1 outline-offset-0 transition-[outline-color] duration-(--motion-small)", on ? "outline-2 outline-ink" : "outline-1 outline-faint group-hover:outline-soft")}>
                {c.key === "auto" ? (
                  // half of each, split down the middle
                  <span className="relative block">
                    <ThemePreview theme={LIGHT_THEME} iconAt="left" />
                    <span className="absolute inset-0 [clip-path:polygon(50%_0,100%_0,100%_100%,50%_100%)]">
                      <ThemePreview theme={DARK_THEME} iconAt="right" />
                    </span>
                  </span>
                ) : (
                  <ThemePreview theme={c.key} />
                )}
              </span>
              <span className="flex items-center gap-1.5 font-sans text-base font-bold text-ink">
                {on && <CheckIcon className="size-4" strokeWidth={3} aria-hidden />}
                {c.label}
              </span>
              <span className="-mt-2 font-serif text-sm leading-snug text-soft">{c.description}</span>
            </button>
          );
        })}
      </div>
    </PageContainer>
  );
}

/* A sketch of a page in a theme, from its preview colours (lib/themes.util.ts):
   the top bar's title and circle, a heading, lines of text, a card in the
   accent, and the bottom nav, with the theme's mark (a sun, a moon) over it,
   in the middle or, where two halves share a preview (Automatic), in the
   middle of its half. Its colours are the theme's own, not the page's, which
   is the point, hence the inline styles. */
function ThemePreview({ theme, iconAt = "center" }: { theme: ThemeKey; iconAt?: "center" | "left" | "right" }) {
  const p = themeByKey(theme).preview;
  const Icon = THEME_ICON[theme];
  return (
    <span className="relative flex aspect-[3/5] w-full flex-col gap-1.5 overflow-hidden px-2 pt-2.5" style={{ background: p.paper }}>
      <span className="flex items-center justify-between">
        <span className="block h-1.5 w-1/3" style={{ background: p.ink }} />
        <span className="block size-3 rounded-full" style={{ background: p.chrome }} />
      </span>
      <span className="mt-2 block h-2.5 w-3/4" style={{ background: p.ink }} />
      <span className="block h-1 w-full" style={{ background: p.soft }} />
      <span className="block h-1 w-5/6" style={{ background: p.soft }} />
      <span className="mt-1 block h-1/5 w-full border" style={{ borderColor: p.ink }}>
        <span className="block h-1 w-full" style={{ background: p.accent }} />
      </span>
      <span className="block h-px w-full" style={{ background: p.faint }} />
      <span className="block h-1 w-2/3" style={{ background: p.soft }} />
      <span className="absolute inset-x-2 bottom-2 block h-3 rounded-full" style={{ background: p.chrome }} />
      <span
        aria-hidden
        className={clsx(
          "absolute top-1/2 flex size-10 -translate-1/2 items-center justify-center rounded-full shadow-float",
          iconAt === "center" ? "left-1/2" : iconAt === "left" ? "left-1/4" : "left-3/4",
        )}
        style={{ background: p.paper, color: p.ink }}
      >
        <Icon className="size-6" />
      </span>
    </span>
  );
}
