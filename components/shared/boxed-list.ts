/* The box a list of rows sits in: an ink outline on a paper surface, the rows
   inside it padded from its sides and ruled apart by ink lines (LinkRow, the
   task and review lists, a profile's languages, a proposal's lines). Like the
   field classes in input.tsx, a class string rather than a component, since
   each caller's rows and the box's own extras differ. */
export const BOXED_LIST = "border border-ink bg-paper px-4";
// the same box for rows that carry their own side padding, because the whole
// row inverts when pressed and so must reach the box's edges
export const BOXED_ROWS = "border border-ink bg-paper";
