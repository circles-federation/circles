/* What an application to join needs, as pure rules shared by the apply form
   (instant feedback) and lib/db/applications.ts (the real check). */

export const APPLICATION_NAME_MAX = 60;
export const APPLICATION_NOTE_MAX = 1000;

/* The beta terms and privacy notes an applicant agrees to (components/legal/),
   named by the date they last changed. Each application records the version
   agreed to, so bump this whenever either one says something new. */
export const BETA_AGREEMENT_VERSION = "2026-10-12";

// just the shape — name@domain.tld, no spaces. Whether it can be used is the server's call.
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ApplicationInput {
  firstName: string;
  lastName: string;
  email: string;
  neighborhoodId: string;
}

export type ApplicationErrors = Partial<Record<keyof ApplicationInput | "photo", string>>;

// every problem at once, by field, so the form can mark each one
export function validateApplication(input: ApplicationInput, hasPhoto: boolean): ApplicationErrors {
  const errors: ApplicationErrors = {};
  if (!input.firstName.trim()) errors.firstName = "Enter your first name.";
  else if (input.firstName.trim().length > APPLICATION_NAME_MAX) errors.firstName = `Keep it under ${APPLICATION_NAME_MAX} characters.`;
  if (!input.lastName.trim()) errors.lastName = "Enter your last name.";
  else if (input.lastName.trim().length > APPLICATION_NAME_MAX) errors.lastName = `Keep it under ${APPLICATION_NAME_MAX} characters.`;
  if (!EMAIL_SHAPE.test(input.email.trim())) errors.email = "Enter an email address, like you@example.com.";
  if (!input.neighborhoodId) errors.neighborhoodId = "Choose the neighborhood you live in.";
  if (!hasPhoto) errors.photo = "Add a photo of your face.";
  return errors;
}
