"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cog6ToothIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useAppState } from "@/components/providers/app-state-provider";
import { avatarFor } from "@/lib/members.util";

/* Home's top bar action: the member's own photo, in the same raised circle as
   every other top bar action, opening a small menu of the places about them
   (their profile, as others see it, and Settings). The menu drops from the
   button like a context menu, with no arrow back to it, and the button sits
   pressed in (its shadow gone) while it's open. A tap outside, Escape or
   choosing an item closes it; arrow keys move between its items. */
export function ProfileMenu() {
  const { profile } = useAppState();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // whatever was chosen, the page it leads to has no menu open
  const [shownOn, setShownOn] = useState(pathname);
  if (pathname !== shownOn) {
    setShownOn(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);

  function onMenuKey(e: KeyboardEvent) {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Tab") setOpen(false);
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      all[(at + step + all.length) % all.length]?.focus();
    }
  }

  function onButtonKey(e: KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    // Enter and Space close it again, as a click would
    if (open && e.key !== "ArrowDown") {
      setOpen(false);
      return;
    }
    setOpen(true);
    // once it's drawn: from the keyboard, the first item takes focus
    requestAnimationFrame(() => items()[0]?.focus());
  }

  const item = "flex items-center gap-3 px-4 py-3 font-sans text-base font-semibold text-ink no-underline outline-offset-[-2px] hover:bg-wash focus-visible:bg-wash active:bg-wash";

  return (
    <div className="relative -mr-0.5">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKey}
        aria-label="You"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="group flex size-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
      >
        {/* raised like the bar's other actions, and pressed in while its menu is open */}
        <span
          className={clsx(
            "relative block size-10 overflow-hidden rounded-full transition-[box-shadow,transform] duration-(--motion-press) group-active:scale-95",
            open ? "scale-95 shadow-none" : "shadow-float",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- the member's own photo, by version */}
          <img src={avatarFor(profile)} alt="" className="size-full object-cover" />
          {/* a ring drawn inside the circle, over the photo, so it keeps its size */}
          <span aria-hidden className="absolute inset-0 rounded-full border border-ink" />
        </span>
      </button>

      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label="You"
          onKeyDown={onMenuKey}
          className="absolute top-full right-0 z-10 mt-2 w-56 origin-top-right animate-menu-in bg-paper shadow-float"
        >
          <Link role="menuitem" href={`/profile/${profile.id}`} onClick={() => setOpen(false)} className={item}>
            <UserCircleIcon className="size-5 shrink-0" strokeWidth={2} aria-hidden />
            My profile
          </Link>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className={clsx(item, "border-t border-faint")}>
            <Cog6ToothIcon className="size-5 shrink-0" strokeWidth={2} aria-hidden />
            Settings
          </Link>
        </div>
      )}
    </div>
  );
}
