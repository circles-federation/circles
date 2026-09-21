/* An error whose message is safe and useful to show the person who caused it
   ("Only members of this circle can manage its resources."). lib/db/actions.ts
   turns these into `{ ok: false, error }` results — anything else is logged
   and reported generically, since Next sanitizes a thrown error's message in
   production and an unexpected one shouldn't leak internals anyway. */
export class UserFacingError extends Error {}
