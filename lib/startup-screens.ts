/* iOS launch images, one per screen it can match exactly: portrait CSS points
   and pixel ratio. scripts/generate-icons.tsx draws them; app/layout.tsx
   points each at its media query. */
export const STARTUP_SCREENS = [
  [440, 956, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [375, 667, 2],
  [1024, 1366, 2],
  [834, 1194, 2],
  [834, 1112, 2],
  [820, 1180, 2],
  [768, 1024, 2],
] as const;

export const startupImages = STARTUP_SCREENS.map(([w, h, r]) => ({
  url: `/icons/startup-${w * r}x${h * r}.png`,
  media: `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
}));
