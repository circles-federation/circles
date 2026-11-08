import { expect, test } from "@playwright/test";
import { MIRA, pageFor } from "./helpers";

const AISHA = "c2qx5017@duck.com";

function tomorrow(): string {
  const d = new Date(Date.now() + 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test("a member creates an event and a neighbor RSVPs to it", async ({ browser }) => {
  const { page } = await pageFor(browser, MIRA);
  await page.goto("/events/new");
  await page.getByLabel("Title").fill("E2E seed swap");
  await page.getByLabel("Date").fill(tomorrow());
  await page.getByLabel("Location").fill("The garden");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/events\/[^/]+$/);
  await expect(page.getByText("E2E seed swap").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Going/ })).toBeVisible();

  const { context: neighbor, page: other } = await pageFor(browser, AISHA);
  await other.goto("/events");
  await other.getByText("E2E seed swap").first().click();
  // an RSVP shows at once and is saved after, so wait for the save before reloading
  const saved = other.waitForResponse((r) => r.request().method() === "POST");
  await other.getByRole("button", { name: "RSVP" }).click();
  await saved;
  await expect(other.getByRole("button", { name: /Going/ })).toBeVisible();
  await other.reload();
  await expect(other.getByRole("button", { name: /Going/ })).toBeVisible();
  await neighbor.close();

  await page.reload();
  await expect(page.getByText("2 going")).toBeVisible();
});
