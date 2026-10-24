"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { BoldIcon, CheckIcon, ItalicIcon, LinkIcon, ListBulletIcon, NumberedListIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { FIELD } from "@/components/shared/input";

interface MessageEditorProps {
  id?: string;
  // Markdown, as it starts and as it's written
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/* What a message to a circle says, formatted as it's written: bold shows as
   bold and a list as a list, with Markdown's own shortcuts too (**bold**, a
   "- " starting a list). Selecting text brings a small toolbar over it
   (bold, italic, a link, a list), as iOS's does; a link asks for its address
   in the toolbar itself. What's kept is Markdown (lib/messages.util.ts reads
   it), and only what the toolbar can make: no headings, quotes or code. */
export function MessageEditor({ id, value, onChange, placeholder, disabled }: MessageEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["mailto"] },
      }),
      Markdown,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    contentType: "markdown",
    editable: !disabled,
    // rendered in the browser only: the server has no editor to draw
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: "textbox",
        "aria-multiline": "true",
        class: clsx("message-text min-h-40 px-3 py-3 font-serif text-base leading-normal text-body", FIELD),
      },
    },
  });

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      {editor && <FormatBar editor={editor} />}
    </div>
  );
}

/* The toolbar over a selection: on chrome (ink, in Sol), each button
   inverting while what it does is on. Link turns it into a field for the
   address, taking a bare one as https. */
function FormatBar({ editor }: { editor: Editor }) {
  const [linking, setLinking] = useState<string | null>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      bullets: e.isActive("bulletList"),
      numbers: e.isActive("orderedList"),
    }),
  });

  function saveLink() {
    const href = (linking ?? "").trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!href) chain.unsetLink().run();
    else chain.setLink({ href: /^(https?:|mailto:)/i.test(href) ? href : `https://${href}` }).run();
    setLinking(null);
  }

  return (
    <BubbleMenu editor={editor} options={{ placement: "top", offset: 8 }} className="z-30 flex bg-chrome text-on-chrome shadow-float">
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
              if (e.key === "Escape") setLinking(null);
            }}
            placeholder="Paste or type a link"
            aria-label="Link address"
            className="h-10 w-56 border-0 bg-transparent px-3 font-sans text-sm text-on-chrome outline-none placeholder:text-on-chrome/60"
          />
          <FormatButton label="Save link" icon={CheckIcon} on={false} submit />
        </form>
      ) : (
        <>
          <FormatButton label="Bold" icon={BoldIcon} on={!!state?.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
          <FormatButton label="Italic" icon={ItalicIcon} on={!!state?.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
          <FormatButton label="Link" icon={LinkIcon} on={!!state?.link} onClick={() => setLinking(editor.getAttributes("link").href ?? "")} />
          <FormatButton label="Bulleted list" icon={ListBulletIcon} on={!!state?.bullets} onClick={() => editor.chain().focus().toggleBulletList().run()} />
          <FormatButton label="Numbered list" icon={NumberedListIcon} on={!!state?.numbers} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        </>
      )}
    </BubbleMenu>
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
      // keeps the selection the button acts on
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx("flex size-11 cursor-pointer items-center justify-center border-0", on ? "bg-on-chrome text-chrome" : "bg-transparent text-on-chrome")}
    >
      <Icon className="size-5" strokeWidth={2} aria-hidden />
    </button>
  );
}
