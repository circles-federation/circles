import fs from "node:fs";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

// the six-digit code in the newest message to this address
async function latestCode(email: string): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(async () => {
      const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`);
      const { messages } = (await res.json()) as { messages: { Snippet: string }[] };
      code = messages[0]?.Snippet.match(/\b\d{6}\b/)?.[0];
      return code;
    }, { message: `a login code emailed to ${email}` })
    .toBeTruthy();
  return code!;
}

export async function signIn(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("One-time code").fill(await latestCode(email));
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL("**/home");
}

// the demo seed's members (lib/data.ts)
// (a login code is one per address a minute, so each test signs in as its own)
export const MIRA = "ycqugou@duck.com";
export const TOMAS = "qxdnrk15@duck.com";
export const RAVI = "zp5pl8b6@duck.com";

/* A context signed in as this member. A login code is one per address a
   minute, so a member signs in once a run (e2e/setup-db.ts clears the saved
   sessions with the database) and every later test reuses it. */
export async function contextFor(browser: Browser, email: string): Promise<BrowserContext> {
  const file = `e2e/.auth/${email}.json`;
  if (!fs.existsSync(file)) {
    const context = await browser.newContext();
    await signIn(await context.newPage(), email);
    fs.mkdirSync("e2e/.auth", { recursive: true });
    await context.storageState({ path: file });
    await context.close();
  }
  return browser.newContext({ storageState: file });
}

export async function pageFor(browser: Browser, email: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await contextFor(browser, email);
  return { context, page: await context.newPage() };
}
