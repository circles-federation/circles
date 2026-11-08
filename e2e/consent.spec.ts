import { expect, test, type Page } from "@playwright/test";
import { MIRA, pageFor } from "./helpers";

const FELIX = "0pqxx887@duck.com";
const PRIYA = "sw5hfa5t@duck.com";

// a Circle must have a domain and aims, so its Details asks for them on any proposal
async function proposeTagline(page: Page, tagline: string) {
  await page.goto("/circles/finance-council/manage/details");
  await page.getByLabel("Tagline").fill(tagline);
  await page.getByLabel("Domain").fill("The block's shared budget");
  await page.getByLabel("Aim 1").fill("Keep the money transparent");
  await page.getByRole("button", { name: "Propose changes" }).click();
  await page.waitForURL(/\/proposals\/[^/]+$/);
}

test("a change to a circle passes once every member consents", async ({ browser }) => {
  const { page } = await pageFor(browser, MIRA);
  await proposeTagline(page, "Every dollar, in the open");
  const proposalUrl = page.url();

  for (const email of [FELIX, PRIYA]) {
    const { context, page: member } = await pageFor(browser, email);
    await member.goto(proposalUrl);
    const answered = member.waitForResponse((r) => r.request().method() === "POST");
    await member.getByRole("button", { name: "Like this" }).click();
    await answered;
    await context.close();
  }

  await expect(async () => {
    await page.goto("/circles/finance-council/wiki");
    await expect(page.getByText("Every dollar, in the open")).toBeVisible({ timeout: 1000 });
  }).toPass();
});

test("one objection closes a proposal without changing the circle", async ({ browser }) => {
  const { page } = await pageFor(browser, FELIX);
  await proposeTagline(page, "Rejected tagline");
  const proposalUrl = page.url();

  const { context, page: priya } = await pageFor(browser, PRIYA);
  await priya.goto(proposalUrl);
  await priya.getByRole("button", { name: "Object" }).click();
  await priya.getByLabel(/why|reason/i).fill("We haven't discussed this.");
  await priya.getByRole("button", { name: "Object" }).last().click();
  await expect(priya.getByText(/objected/i).first()).toBeVisible();
  await context.close();

  await page.goto("/circles/finance-council/wiki");
  await expect(page.getByText("Finance Council").first()).toBeVisible();
  await expect(page.getByText("Rejected tagline")).toHaveCount(0);
});
