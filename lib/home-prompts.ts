/* Home's one-time prompts (turning on push, filling in a profile) remember
   being answered in this browser's storage: a prompt is about this device
   (push) or is a gentle nudge that shouldn't need a table of its own (the
   profile). Storage can be unavailable or cleared, which at worst means
   asking once more. */

export const PUSH_PROMPT_KEY = "circles.pushPromptAnswered";
export const profilePromptKey = (memberId: number) => `circles.profilePromptAnswered.${memberId}`;

export function promptAnswered(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function markPromptAnswered(key: string): void {
  try {
    localStorage.setItem(key, new Date().toISOString());
  } catch {
    // nowhere to remember it: it may be asked once more
  }
}
