import { expect, test } from "@playwright/test";
import { fillField, pageFor } from "./helpers";

// each the only member of their co-op, and used by no other test
const ESPERANZA = "1hh8c8h@duck.com";
const MARISOL = "df5rzwg@duck.com";

test("two co-ops form a federation, each sending its delegate", async ({ browser }) => {
  const { page } = await pageFor(browser, ESPERANZA);
  await page.goto("/circles/sol-power/manage");
  await page.getByRole("link", { name: /Federate/ }).click();
  await fillField(page.getByLabel("Name"), "Providence Co-op Alliance");

  await page.getByRole("button", { name: "Add circle" }).click();
  const explorer = page.getByRole("dialog");
  await fillField(explorer.getByPlaceholder("Search all circles"), "Four Buds");
  await explorer.getByRole("button", { name: /Four Buds/ }).click();
  await explorer.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Sol Power Solar’s delegate" }).click();
  await page.getByRole("option", { name: /Esperanza/ }).click();
  await page.getByRole("button", { name: "Propose federation" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Propose federation" }).click();
  await page.waitForURL(/\/proposals\/[^/]+$/);
  const proposalUrl = page.url();

  const { context, page: marisol } = await pageFor(browser, MARISOL);
  await marisol.goto(proposalUrl);
  await marisol.getByRole("button", { name: "Choose a delegate" }).click();
  await marisol.getByRole("option", { name: /Marisol/ }).click();
  const nominated = marisol.waitForResponse((r) => r.request().method() === "POST");
  await marisol.getByRole("button", { name: "Put forward" }).click();
  await nominated;
  await marisol.getByRole("button", { name: "Like this" }).click();
  await marisol.getByRole("button", { name: "Confirm" }).click();
  await expect(marisol.getByRole("status").getByText("Passed", { exact: true })).toBeVisible();

  // it holds both co-ops, and its members are their delegates
  await marisol.getByRole("button", { name: "Go to Providence Co-op Alliance" }).click();
  await marisol.waitForURL(/\/circles\/providence-co-op-alliance/);
  await marisol.goto("/circles/providence-co-op-alliance/wiki");
  await expect(marisol.getByText("Sol Power Solar").first()).toBeVisible();
  await expect(marisol.getByText("Four Buds Floral Studio").first()).toBeVisible();
  await marisol.goto("/circles/providence-co-op-alliance/members");
  await expect(marisol.getByText("Esperanza").first()).toBeVisible();
  await expect(marisol.getByText("Marisol").first()).toBeVisible();
  await context.close();
});
