"use client";

import { useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode, type SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export interface TopBarMenuItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // the icon's own colour, where it has one (Learn names' teal)
  iconClassName?: string;
}

interface TopBarMenuProps {
  // the button's and the menu's name for screen readers
  label: string;
  // what fills the button's circle: the member's photo, or an icon on ink
  face: ReactNode;
  items: TopBarMenuItem[];
}

/* A top bar action that opens a small menu (Home's photo: My profile and
   Settings; the Circles browser's: New circle and the rest), in the same
   raised circle as every other top bar action. The menu drops from the
   button like a context menu, with no arrow back to it, and the button sits
   pressed in (its shadow gone) while it's open. A tap outside, Escape or
   choosing an item closes it; arrow keys move between its items, and Enter
   or Space on the button opens or closes it. */
export function TopBarMenu({ label, face, items }: TopBarMenuProps) {
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

  const menuItems = () => Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);

  function onMenuKey(e: KeyboardEvent) {
    const all = menuItems();
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
    requestAnimationFrame(() => menuItems()[0]?.focus());
  }

  return (
    <div className="relative -mr-0.5">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKey}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="group flex size-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
      >
        {/* raised like the bar's other actions, and pressed in while its menu is open */}
        <span
          className={clsx(
            "relative flex size-10 items-center justify-center overflow-hidden rounded-full transition-[box-shadow,transform] duration-(--motion-press) group-active:scale-95",
            open ? "scale-95 shadow-none" : "shadow-float",
          )}
        >
          {face}
        </span>
      </button>

      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute top-full right-0 z-10 mt-2 w-56 origin-top-right animate-menu-in bg-paper shadow-float"
        >
          {items.map(({ label: itemLabel, href, icon: Icon, iconClassName }, i) => (
            <Link
              key={href}
              role="menuitem"
              href={href}
              onClick={() => setOpen(false)}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 font-sans text-base font-semibold text-ink no-underline outline-offset-[-2px] hover:bg-wash focus-visible:bg-wash active:bg-wash",
                i > 0 && "border-t border-faint",
              )}
            >
              <Icon className={clsx("size-5 shrink-0", iconClassName)} strokeWidth={2} aria-hidden />
              {itemLabel}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// a menu button's face when it's an icon: white on ink, like the bar's other
// secondary actions
export function MenuIconFace({ icon: Icon }: { icon: ComponentType<SVGProps<SVGSVGElement>> }) {
  return (
    <span className="flex size-full items-center justify-center bg-ink text-paper">
      <Icon className="size-5" strokeWidth={2.5} />
    </span>
  );
}
