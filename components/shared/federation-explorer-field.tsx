"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CheckIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { TopBarAction } from "@/components/providers/top-bar-action-provider";
import { circleAncestors, indexCircles } from "@/lib/circles.util";
import type { Circle } from "@/lib/types";
import { isPhoneWidth } from "@/lib/viewport";
import { CircleTypeIcon } from "./circle-type-icon";
import { FederationExplorer, startingFolder } from "./federation-explorer";
import { ICON_BUTTON_SLOT, IconButtonCircle } from "./icon-button-circle";
import { DISABLED_FIELD, FIELD } from "./input";
import { Modal } from "./modal";
import { PageContainer } from "./page-container";

interface FederationExplorerOptions {
  // the explorer's heading ("Parent circle")
  title: string;
  circles: Circle[];
  value: string | null;
  onChange: (id: string) => void;
  // why a circle can't be chosen, or null when it can (see FederationExplorer)
  refusal: (circle: Circle) => string | null;
}

interface FederationExplorerHandle {
  open: () => void;
  // on a phone, a view the form shows in place of its fields while it's open,
  // as the event form does its Roles: the top bar stays the page's own
  view: ReactNode;
  // on desktop, a dialog the form renders anywhere
  dialog: ReactNode;
  // while the view's open, the form's top bar action and Back give way to
  // these: Choose the circle it's in, and Back to the form
  topBarAction: TopBarAction | null;
  backHandler: (() => void) | null;
}

/* The Federation Explorer for a field in a form, opened from
   FederationExplorerField: a view swapped in for the form on a phone, so the
   draft survives and the top bar is the page's own, with Choose its action
   and Back returning to the form; a dialog on desktop, Choose in its header.
   Which is decided at the tap. The form shows `view` in place of its fields
   while it's there, renders `dialog`, and lets `topBarAction` and
   `backHandler` take precedence over its own. */
export function useFederationExplorer({ title, circles, value, onChange, refusal }: FederationExplorerOptions): FederationExplorerHandle {
  const [mode, setMode] = useState<"view" | "dialog" | null>(null);
  const [at, setAt] = useState("");
  const [query, setQuery] = useState("");
  const byId = useMemo(() => indexCircles(circles), [circles]);
  const folder = byId[at];
  // the circle it's in, unless searching (when it isn't what's on screen)
  const choosable = folder && !query.trim() && !refusal(folder) ? folder : null;

  function open() {
    setAt(startingFolder(value, circles, byId) ?? circles.find((c) => c.parentId === null)?.id ?? "");
    setQuery("");
    setMode(isPhoneWidth() ? "view" : "dialog");
  }
  const close = () => setMode(null);
  function choose(id: string) {
    onChange(id);
    close();
  }

  const explorer = (
    <FederationExplorer
      circles={circles}
      value={value}
      refusal={refusal}
      at={at}
      onOpen={(id) => {
        setAt(id);
        setQuery("");
      }}
      query={query}
      onQuery={setQuery}
      onChoose={choose}
    />
  );
  const chooseLabel = folder ? `Choose ${folder.name}` : "Choose";

  return {
    open,
    view:
      mode === "view" ? (
        <PageContainer size="compact">
          <h2 className="mb-5 font-sans text-xl font-extrabold tracking-heading">{title}</h2>
          {explorer}
        </PageContainer>
      ) : null,
    dialog:
      mode === "dialog" ? (
        <Modal
          title={title}
          onClose={close}
          className="max-w-130"
          action={
            <button
              type="button"
              onClick={() => choosable && choose(choosable.id)}
              disabled={!choosable}
              aria-label={chooseLabel}
              title={chooseLabel}
              className={clsx(ICON_BUTTON_SLOT, "cursor-pointer border-0 bg-transparent p-0 disabled:cursor-default")}
            >
              <IconButtonCircle icon={CheckIcon} variant="primary" />
            </button>
          }
        >
          <div className="p-5">{explorer}</div>
        </Modal>
      ) : null,
    topBarAction: mode === "view" ? { label: chooseLabel, icon: CheckIcon, onAction: () => choosable && choose(choosable.id), disabled: !choosable, variant: "primary" } : null,
    backHandler: mode === "view" ? close : null,
  };
}

interface FederationExplorerFieldProps {
  id?: string;
  circles: Circle[];
  value: string | null;
  // opens the explorer (useFederationExplorer's open)
  onOpen: () => void;
  placeholder?: string;
  disabled?: boolean;
}

/* A field for choosing a circle: shows the one chosen, its icon and name
   with where it sits under it, and opens the Federation Explorer to change
   it (useFederationExplorer). */
export function FederationExplorerField({ id, circles, value, onOpen, placeholder = "Choose a circle", disabled }: FederationExplorerFieldProps) {
  const byId = useMemo(() => indexCircles(circles), [circles]);
  const chosen = value ? byId[value] : undefined;
  const path = chosen ? (chosen.parentId === null ? "The whole city" : circleAncestors(chosen, byId).map((c) => c.name).join(" › ")) : null;

  return (
    <button
      id={id}
      type="button"
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={onOpen}
      className={clsx("relative flex w-full items-center gap-3 py-3 pr-9 pl-3 text-left", disabled ? DISABLED_FIELD : clsx("cursor-pointer", FIELD))}
    >
      {chosen ? (
        <>
          <CircleTypeIcon circle={chosen} className="size-5 shrink-0" strokeWidth={2} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-sans text-base font-bold">{chosen.name}</span>
            <span className="block truncate font-sans text-sm text-soft">{path}</span>
          </span>
        </>
      ) : (
        <span className="min-w-0 flex-1 font-serif text-base text-soft">{placeholder}</span>
      )}
      {/* a chevron to the side, since it opens somewhere rather than dropping down */}
      {!disabled && <ChevronRightIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-soft" strokeWidth={2} aria-hidden />}
    </button>
  );
}
