/* Whether the screen is phone-sized: under the app's 720px breakpoint (the
   `min-[720px]:` used throughout). Read at the moment it's needed, such as on
   a tap, never during render, so there's no server/client mismatch — where a
   phone gets a page and desktop a dialog, the tap decides. */
export function isPhoneWidth(): boolean {
  return window.matchMedia("(max-width: 719px)").matches;
}
