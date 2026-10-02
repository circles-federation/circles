/* Whether the screen is phone-sized: under the app's 720px breakpoint (the
   `min-[720px]:` used throughout). Read at the moment it's needed, such as on
   a tap, never during render, so there's no server/client mismatch — where a
   phone gets a page and desktop a dialog, the tap decides. */
export function isPhoneWidth(): boolean {
  return window.matchMedia("(max-width: 719px)").matches;
}

// running from the home screen rather than in a browser tab (iOS's own flag
// covers home-screen apps that predate display-mode support). Browser-only,
// like isPhoneWidth: in render, read it through useSyncExternalStore.
export function isInstalledApp(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// an iPhone's browser tab rather than the installed app: where iOS offers
// neither installing (no install API) nor push, short of Add to Home Screen
export function isIPhoneBrowserTab(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent) && !isInstalledApp();
}
