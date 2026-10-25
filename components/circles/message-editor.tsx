"use client";

import { useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import { EditorSelection, EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, keymap, placeholder as placeholderText, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import { markdown } from "@codemirror/lang-markdown";
import { BoldIcon, CheckIcon, ItalicIcon, LinkIcon, ListBulletIcon, NumberedListIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { FIELD_ROW } from "@/components/shared/input";

interface MessageEditorProps {
  id?: string;
  // Markdown, as it starts and as it's written
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  // written straight onto the page (the letter being written), rather than
  // in a field: no ground or rule, and set a size up
  bare?: boolean;
}

/* What a message to a circle says, written in Markdown and shown as it will
   read, as Obsidian's live preview does: bold is bold and a link underlined,
   their Markdown hidden, until the cursor or a selection is on them, when
   their symbols show, in grey, to edit by hand (`**spring**`). List markers
   always show, reading as they look. Selecting text, or putting the cursor
   in formatted words, brings a small toolbar over it (bold, italic, a link,
   the two lists), which writes the same Markdown one would type, so the two
   are one way of writing; ⌘B and ⌘I too. Its bold and italic act on the
   whole of what's formatted, or the whole word, rather than the cursor's
   one spot.
   What's kept is the Markdown itself (lib/messages.util.ts reads it).
   CodeMirror, since it edits the text itself rather than a model of it,
   which is what lets the symbols be shown and edited at all. */
export function MessageEditor({ id, value, onChange, placeholder, bare }: MessageEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const [bar, setBar] = useState<{ top: number; left: number; on: Formats } | null>(null);
  // the toolbar's link field, while it's open: it takes focus from the
  // editor, which would otherwise take the toolbar away with it
  const [linking, setLinking] = useState<string | null>(null);
  const linkingRef = useRef(linking);
  useEffect(() => {
    linkingRef.current = linking;
  });
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([
            { key: "Mod-b", run: (x) => wrap(x, "**") },
            { key: "Mod-i", run: (x) => wrap(x, "*") },
            ...historyKeymap,
            ...defaultKeymap,
          ]),
          markdown(),
          livePreview,
          EditorView.lineWrapping,
          placeholderText(placeholder ?? ""),
          EditorView.contentAttributes.of({ ...(id ? { id } : {}), "aria-multiline": "true", "aria-label": "Message" }),
          // earlier extensions win in CodeMirror, so the page's own look first
          ...(bare ? [bareTheme] : []),
          editorTheme,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
            if (u.selectionSet || u.focusChanged || u.docChanged || u.geometryChanged) setBar((was) => (linkingRef.current !== null ? was : placeBar(u.view)));
          }),
        ],
      }),
    });
    setView(v);
    return () => v.destroy();
    // the editor is made once; later values are its own (a new message remounts it)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      <div ref={host} className={bare ? "block" : clsx(FIELD_ROW, "block has-[.cm-focused]:border-ink has-[.cm-focused]:shadow-[inset_0_-1px_0_var(--color-ink)]")} />
      {view && bar && (
        <FormatBar
          view={view}
          at={bar}
          linking={linking}
          onLinking={(next) => {
            setLinking(next);
            // done with the field: back to wherever the selection now is
            if (next === null) setBar(placeBar(view));
          }}
        />
      )}
    </div>
  );
}

// what the selection is in, for the toolbar to show as on
interface Formats {
  bold: boolean;
  italic: boolean;
  link: boolean;
}

/* Where the toolbar goes, while the editor has focus: over the start of a
   selection, or, with none, over the formatted words the cursor is in (a
   formatted word counts as selected); nowhere otherwise. Relative to the
   editor. */
function placeBar(view: EditorView): { top: number; left: number; on: Formats } | null {
  if (!view.hasFocus) return null;
  const sel = view.state.selection.main;
  const on = { bold: !!enclosing(view.state, "StrongEmphasis"), italic: !!enclosing(view.state, "Emphasis"), link: !!enclosing(view.state, "Link") };
  const formatted = enclosing(view.state, "StrongEmphasis") ?? enclosing(view.state, "Emphasis") ?? enclosing(view.state, "Link");
  if (sel.empty && !formatted) return null;
  const at = view.coordsAtPos(sel.empty && formatted ? formatted.from : sel.from);
  const box = view.dom.getBoundingClientRect();
  if (!at) return null;
  return { top: at.top - box.top, left: Math.max(0, at.left - box.left), on };
}

// the formatted span of this kind (StrongEmphasis, Emphasis, Link) the
// selection is in, if any: looked for either side of its start, so a cursor
// at a word's very edge still counts
function enclosing(state: EditorState, name: string): SyntaxNode | null {
  const { from, to } = state.selection.main;
  for (const side of [1, -1] as const) {
    for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(from, side); n; n = n.parent) {
      if (n.name === name && n.from <= from && n.to >= to) return n;
    }
  }
  return null;
}

/* Bold or italic, as Markdown, on the whole of what's meant: if the
   selection (or the cursor) is in text that's already so, the whole of that
   run is undone, its markers taken away; otherwise the selection gets the
   marker either side, or with nothing selected the word the cursor is in
   does. So a second tap undoes the first. */
function wrap(view: EditorView, marker: string): boolean {
  const { state } = view;
  const formatted = enclosing(state, marker === "**" ? "StrongEmphasis" : "Emphasis");
  if (formatted) {
    const marks = formatted.getChildren("EmphasisMark");
    view.dispatch({ changes: marks.map((m) => ({ from: m.from, to: m.to })), userEvent: "input" });
    view.focus();
    return true;
  }
  const sel = state.selection.main;
  const word = sel.empty ? state.wordAt(sel.head) : null;
  if (word) {
    view.dispatch({ changes: [{ from: word.from, insert: marker }, { from: word.to, insert: marker }], selection: EditorSelection.cursor(sel.head + marker.length), userEvent: "input" });
    view.focus();
    return true;
  }
  const changes = state.changeByRange((r) => {
    const n = marker.length;
    const before = state.sliceDoc(r.from - n, r.from);
    const after = state.sliceDoc(r.to, r.to + n);
    // bold's ** isn't italic's * twice over
    const exact = (s: string, at: number) => s === marker && (marker !== "*" || (state.sliceDoc(at - 1, at) !== "*" && state.sliceDoc(at + 1, at + 2) !== "*"));
    if (exact(before, r.from - n) && exact(after, r.to)) {
      return { changes: [{ from: r.from - n, to: r.from }, { from: r.to, to: r.to + n }], range: EditorSelection.range(r.from - n, r.to - n) };
    }
    const text = state.sliceDoc(r.from, r.to);
    if (text.length > 2 * n && text.startsWith(marker) && text.endsWith(marker)) {
      return { changes: { from: r.from, to: r.to, insert: text.slice(n, -n) }, range: EditorSelection.range(r.from, r.to - 2 * n) };
    }
    return { changes: [{ from: r.from, insert: marker }, { from: r.to, insert: marker }], range: EditorSelection.range(r.from + n, r.to + n) };
  });
  view.dispatch(changes, { scrollIntoView: true, userEvent: "input" });
  view.focus();
  return true;
}

/* A link to `href`: the link the cursor is in, readdressed (or, with no
   address, back to its words alone), or the selection (or the word the
   cursor's in) made one, [its words](href) */
function link(view: EditorView, href: string) {
  const { state } = view;
  const existing = enclosing(state, "Link");
  const marks = existing?.getChildren("LinkMark") ?? [];
  if (existing && marks.length >= 2) {
    const words = state.sliceDoc(marks[0]!.to, marks[1]!.from);
    const insert = href ? `[${words}](${href})` : words;
    view.dispatch({ changes: { from: existing.from, to: existing.to, insert }, selection: EditorSelection.cursor(existing.from + insert.length), userEvent: "input" });
    view.focus();
    return;
  }
  if (!href) return view.focus();
  const sel = state.selection.main;
  const r = sel.empty ? (state.wordAt(sel.head) ?? sel) : sel;
  const words = state.sliceDoc(r.from, r.to) || href;
  const insert = `[${words}](${href})`;
  view.dispatch({ changes: { from: r.from, to: r.to, insert }, selection: EditorSelection.cursor(r.from + insert.length), userEvent: "input" });
  view.focus();
}

// the address of the link the cursor is in, to start the toolbar's field with
function linkHref(view: EditorView): string {
  const node = enclosing(view.state, "Link")?.getChild("URL");
  return node ? view.state.sliceDoc(node.from, node.to) : "";
}

/* The selection's lines as a list, bulleted ("- ") or numbered ("1. ",
   "2. "…), or not, if they already all are */
function list(view: EditorView, numbered: boolean) {
  const { state } = view;
  const r = state.selection.main;
  const first = state.doc.lineAt(r.from).number;
  const last = state.doc.lineAt(r.to).number;
  const pattern = numbered ? /^\d+[.)]\s/ : /^[-*+]\s/;
  const lines = Array.from({ length: last - first + 1 }, (_, i) => state.doc.line(first + i));
  const all = lines.every((l) => pattern.test(l.text));
  const changes = lines.map((l, i) => {
    const marker = l.text.match(/^(\d+[.)]|[-*+])\s/)?.[0] ?? "";
    return all ? { from: l.from, to: l.from + marker.length } : { from: l.from, to: l.from + marker.length, insert: numbered ? `${i + 1}. ` : "- " };
  });
  view.dispatch({ changes, userEvent: "input" });
  view.focus();
}

/* The toolbar over a selection: on chrome (ink, in Sol), each button
   inverting while what it does is on. Link turns it into a field for the
   address, taking a bare one as https. */
function FormatBar({ view, at, linking, onLinking: setLinking }: { view: EditorView; at: { top: number; left: number; on: Formats }; linking: string | null; onLinking: (value: string | null) => void }) {

  // an empty address takes a link away
  function saveLink() {
    const href = (linking ?? "").trim();
    link(view, !href || /^(https?:|mailto:)/i.test(href) ? href : `https://${href}`);
    setLinking(null);
  }

  return (
    <div
      // over the selection, clear of it, kept on the editor's width
      className="absolute z-30 flex -translate-y-full bg-chrome text-on-chrome shadow-float"
      style={{ top: at.top - 8, left: Math.min(at.left, Math.max(0, view.dom.clientWidth - (linking !== null ? 268 : 220))) }}
      // keeps the selection the toolbar acts on
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
      }}
    >
      {linking !== null ? (
        <form
          className="flex items-center"
          onSubmit={(e) => {
            e.preventDefault();
            saveLink();
          }}
        >
          <input
            autoFocus
            value={linking}
            onChange={(e) => setLinking(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setLinking(null);
                view.focus();
              }
            }}
            placeholder="Paste or type a link"
            aria-label="Link address"
            className="h-11 w-56 border-0 bg-transparent px-3 font-sans text-sm text-on-chrome outline-none placeholder:text-on-chrome/60"
          />
          <FormatButton label="Save link" icon={CheckIcon} on={false} submit />
        </form>
      ) : (
        <>
          <FormatButton label="Bold" icon={BoldIcon} on={at.on.bold} onClick={() => wrap(view, "**")} />
          <FormatButton label="Italic" icon={ItalicIcon} on={at.on.italic} onClick={() => wrap(view, "*")} />
          <FormatButton label="Link" icon={LinkIcon} on={at.on.link} onClick={() => setLinking(linkHref(view))} />
          <FormatButton label="Bulleted list" icon={ListBulletIcon} on={false} onClick={() => list(view, false)} />
          <FormatButton label="Numbered list" icon={NumberedListIcon} on={false} onClick={() => list(view, true)} />
        </>
      )}
    </div>
  );
}

// `submit` sends the link's form; the rest act on the selection
function FormatButton({ label, icon: Icon, on, onClick, submit }: { label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; on: boolean; onClick?: () => void; submit?: boolean }) {
  return (
    <button
      type={submit ? "submit" : "button"}
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={onClick}
      className={clsx("flex size-11 cursor-pointer items-center justify-center border-0", on ? "bg-on-chrome text-chrome" : "bg-transparent text-on-chrome")}
    >
      <Icon className="size-5" strokeWidth={2} aria-hidden />
    </button>
  );
}

/* The live preview: the Markdown styled as it will read, its symbols hidden
   except on what the cursor or a selection touches, where they show in grey
   to be edited. Worked out again whenever the text or the selection moves. */
const FORMATTED: Record<string, string> = { StrongEmphasis: "cm-md-strong", Emphasis: "cm-md-em", Link: "cm-md-link" };
// the symbols each formatted span is made of
const SYMBOLS = new Set(["EmphasisMark", "LinkMark", "URL", "LinkTitle"]);

function preview(view: EditorView): DecorationSet {
  const { state } = view;
  const ranges: Range<Decoration>[] = [];
  const touched = (from: number, to: number) => state.selection.ranges.some((r) => r.from <= to && r.to >= from);
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const style = FORMATTED[node.name];
        if (style) ranges.push(Decoration.mark({ class: style }).range(node.from, node.to));
        if (node.name === "ListMark") ranges.push(Decoration.mark({ class: "cm-md-symbol" }).range(node.from, node.to));
        if (SYMBOLS.has(node.name) && node.node.parent && FORMATTED[node.node.parent.name]) {
          const parent = node.node.parent;
          if (touched(parent.from, parent.to)) ranges.push(Decoration.mark({ class: "cm-md-symbol" }).range(node.from, node.to));
          else if (node.to > node.from) ranges.push(Decoration.replace({}).range(node.from, node.to));
        }
      },
    });
  }
  return Decoration.set(ranges, true);
}

const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = preview(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = preview(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);

// the field's own look, in the theme's colours (so Luna's too)
const editorTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--color-body)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-serif)", fontSize: "1rem", lineHeight: "1.5" },
  ".cm-content": { minHeight: "10rem", padding: "12px", caretColor: "var(--color-ink)" },
  ".cm-line": { padding: "0" },
  ".cm-placeholder": { color: "var(--color-soft)" },
  ".cm-md-strong": { fontWeight: "700", color: "var(--color-ink)" },
  ".cm-md-em": { fontStyle: "italic" },
  ".cm-md-link": { color: "var(--color-ink)", textDecoration: "underline", textUnderlineOffset: "2px" },
  ".cm-md-symbol": { color: "var(--color-soft)", fontWeight: "400", fontStyle: "normal", textDecoration: "none" },
});

// written onto the page: the letter's own size, and its edge for the field's
const bareTheme = EditorView.theme({
  ".cm-scroller": { fontSize: "1.125rem", lineHeight: "1.6" },
  ".cm-content": { minHeight: "14rem", padding: "0" },
});
