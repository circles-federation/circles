import { expect, test } from "@playwright/test";
import { RAVI, TOMAS, signIn } from "./helpers";

test("a signed-out visitor is sent to the welcome page", async ({ page }) => {
  await page.goto("/circles");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
});

test("an unknown email is turned away", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill("nobody@example.test");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText("We don't recognize that email yet")).toBeVisible();
});

test("a member signs in with an emailed code and lands on Home", async ({ page }) => {
  await signIn(page, RAVI);
  await expect(page.getByText(/Good (morning|afternoon|evening), Ravi/)).toBeVisible();
});

test("a wrong code is refused", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill(TOMAS);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("One-time code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).not.toHaveURL(/\/home/);
});
