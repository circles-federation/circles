"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CheckIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { TopBarAction } from "@/components/providers/top-bar-action-provider";
import { circleAncestors, indexCircles } from "@/lib/circles.util";
import { isPhoneWidth } from "@/lib/viewport";
import { CircleTypeIcon } from "./circle-type-icon";
import { FederationExplorer, startingFolder, type ExplorerCircle, type ExplorerYou } from "./federation-explorer";
import { ICON_BUTTON_SLOT, IconButtonCircle } from "./icon-button-circle";
import { DISABLED_FIELD, FIELD } from "./input";
import { Modal } from "./modal";
import { PageContainer } from "./page-container";

interface FederationExplorerOptions<T extends ExplorerCircle> {
  // the explorer's heading ("Parent circle")
  title: string;
  circles: T[];
  value: string | null;
  onChange: (id: string) => void;
  // why a circle can't be chosen, or null when it can (see FederationExplorer)
  refusal: (circle: T) => string | null;
  // the signed-in member, whose neighborhood and circles are marked
  you?: ExplorerYou;
  // a dialog on every screen, for a page outside the app with no top bar to
  // put Done in (the application form)
  dialogOnly?: boolean;
}

interface FederationExplorerHandle {
  open: () => void;
  // on a phone, a view the form shows in place of its fields while it's open,
  // as the event form does its Roles: the top bar stays the page's own
  view: ReactNode;
  // on desktop, a dialog the form renders anywhere
  dialog: ReactNode;
  // while the view's open, the form's top bar action and Back give way to
  // these: Done, and Back to the form
  topBarAction: TopBarAction | null;
  backHandler: (() => void) | null;
}

/* The Federation Explorer for a field in a form, opened from
   FederationExplorerField: a view swapped in for the form on a phone, so the
   draft survives and the top bar is the page's own, with Back returning to
   the form; a dialog on desktop. Either way a tap only picks a circle, and
   Done (the top bar's action, or in the dialog's header) keeps it, or with
   none picked the circle it's in, once that's a change.
   Which is decided at the tap. The form shows `view` in place of its fields
   while it's there, renders `dialog`, and lets `topBarAction` and
   `backHandler` take precedence over its own. */
export function useFederationExplorer<T extends ExplorerCircle>({ title, circles, value, onChange, refusal, you, dialogOnly }: FederationExplorerOptions<T>): FederationExplorerHandle {
  const [mode, setMode] = useState<"view" | "dialog" | null>(null);
  const [at, setAt] = useState("");
  const [query, setQuery] = useState("");
  // a circle tapped is only picked, checked until Done keeps it
  const [picked, setPicked] = useState<string | null>(null);
  const byId = useMemo(() => indexCircles(circles), [circles]);
  const folder = byId[at];
  // the circle it's in, unless searching (when it isn't what's on screen)
  const choosable = folder && !query.trim() && !refusal(folder) ? folder : null;
  // what Done keeps: the circle picked, or else the one it's in; off until
  // that's a change
  const kept = picked ?? choosable?.id ?? null;
  const done = kept !== value ? kept : null;

  function open() {
    setAt(startingFolder(value, circles, byId) ?? circles.find((c) => c.parentId === null)?.id ?? "");
    setQuery("");
    setPicked(value);
    setMode(isPhoneWidth() && !dialogOnly ? "view" : "dialog");
  }
  const close = () => setMode(null);
  function choose(id: string) {
    onChange(id);
    close();
  }

  const explorer = (
    <FederationExplorer
      circles={circles}
      value={picked}
      refusal={refusal}
      {...(you ? { you } : {})}
      at={at}
      onOpen={(id) => {
        setAt(id);
        setQuery("");
        // a pick is of what's in view: opening another circle lets it go
        setPicked(null);
      }}
      query={query}
      onQuery={setQuery}
      onChoose={setPicked}
    />
  );

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
              onClick={() => done && choose(done)}
              disabled={!done}
              aria-label="Done"
              title="Done"
              className={clsx(ICON_BUTTON_SLOT, "cursor-pointer border-0 bg-transparent p-0 disabled:cursor-default")}
            >
              <IconButtonCircle icon={CheckIcon} variant="primary" />
            </button>
          }
        >
          <div className="p-5">{explorer}</div>
        </Modal>
      ) : null,
    topBarAction: mode === "view" ? { label: "Done", icon: CheckIcon, onAction: () => done && choose(done), disabled: !done, variant: "primary" } : null,
    backHandler: mode === "view" ? close : null,
  };
}

interface FederationExplorerFieldProps {
  id?: string;
  circles: ExplorerCircle[];
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
