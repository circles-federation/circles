"use client";

import { useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode, type SVGProps } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export interface TopBarMenuItem {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // the icon's own colour, where it has one (Learn names' teal)
  iconClassName?: string;
  // where it goes, or what it does (Share); `file` for a link the browser
  // opens itself rather than the app's router (Add to calendar's .ics)
  href?: string;
  file?: boolean;
  onSelect?: () => void;
  // shown, so it's plain it exists, but not yet to be chosen (Add to
  // calendar before you've RSVPed)
  disabled?: boolean;
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
   choosing an item closes it. Outside, that tap does nothing else: while it's
   open, a clear layer covers the screen, bars included, so what's under the
   finger isn't pressed too (the menu sits over that layer, so both are laid
   on the page itself rather than in the top bar, placed from the button); arrow keys move between its items, and Enter
   or Space on the button opens or closes it. */
export function TopBarMenu({ label, face, items }: TopBarMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // where the menu hangs, under the button's right edge, read as it opens
  const [place, setPlace] = useState({ top: 0, right: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // whatever was chosen, the page it leads to has no menu open
  const [shownOn, setShownOn] = useState(pathname);
  if (pathname !== shownOn) {
    setShownOn(pathname);
    setOpen(false);
  }

  function show() {
    const box = button.current?.getBoundingClientRect();
    if (box) setPlace({ top: box.bottom + 8, right: window.innerWidth - box.right });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    // placed from where the button was: a resize (a phone turned) moves it
    const away = () => setOpen(false);
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener("resize", away);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const menuItems = () => Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? []);

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
    show();
    // once it's drawn: from the keyboard, the first item takes focus
    requestAnimationFrame(() => menuItems()[0]?.focus());
  }

  return (
    <div className="relative -mr-0.5">
      <button
        ref={button}
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
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

      {open &&
        createPortal(
          <>
            {/* over everything but dialogs and toasts: a tap on it only closes the menu */}
            <div aria-hidden className="fixed inset-0 z-60" onClick={() => setOpen(false)} />
            <div
              ref={menu}
              id={menuId}
              role="menu"
              aria-label={label}
              onKeyDown={onMenuKey}
              style={{ top: place.top, right: place.right }}
              className="fixed z-60 w-56 origin-top-right animate-menu-in bg-paper shadow-float"
            >
              {items.map(({ label: itemLabel, href, file, onSelect, disabled, icon: Icon, iconClassName }, i) => {
                const className = clsx(
                  "flex w-full items-center gap-3 border-0 bg-paper px-4 py-3 text-left font-sans text-base font-semibold no-underline outline-offset-[-2px]",
                  disabled ? "cursor-default text-ghost" : "cursor-pointer text-ink hover:bg-wash focus-visible:bg-wash active:bg-wash",
                  i > 0 && "border-t border-solid border-faint",
                );
                const content = (
                  <>
                    <Icon className={clsx("size-5 shrink-0", iconClassName)} strokeWidth={2} aria-hidden />
                    {itemLabel}
                  </>
                );
                const choose = () => {
                  setOpen(false);
                  onSelect?.();
                };
                if (disabled) {
                  return (
                    <button key={itemLabel} type="button" role="menuitem" aria-disabled disabled className={className}>
                      {content}
                    </button>
                  );
                }
                if (!href) return <button key={itemLabel} type="button" role="menuitem" onClick={choose} className={className}>{content}</button>;
                if (file) return <a key={itemLabel} role="menuitem" href={href} onClick={choose} className={className}>{content}</a>;
                return <Link key={itemLabel} role="menuitem" href={href} onClick={choose} className={className}>{content}</Link>;
              })}
            </div>
          </>,
          document.body,
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
