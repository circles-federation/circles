/* Printing the page, from a tap. In an installed iPhone app window.print()
   does nothing, while the older document.execCommand("print") still opens
   the print sheet there, so that's tried first; it's deprecated, so a
   browser that refuses it (returns false, or throws) gets window.print(). */
export function printPage(): void {
  try {
    if (!document.execCommand("print", false)) window.print();
  } catch {
    window.print();
  }
}
