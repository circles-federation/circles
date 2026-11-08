import { expect, test } from "@playwright/test";
import { MIRA, pageFor } from "./helpers";

const PRIYA = "sw5hfa5t@duck.com";
const CARMEN = "awyhz93@duck.com";

test("an announcement reaches the circle's members and no one else", async ({ browser }) => {
  const { page: mira } = await pageFor(browser, MIRA);
  await mira.goto("/circles/finance-council/bulletin/new");
  await mira.getByLabel("Title").fill("E2E budget meeting moved");
  await mira.getByLabel("Message").fill("We're meeting Thursday instead.");
  await mira.getByRole("button", { name: "Save" }).click();
  await expect(mira).toHaveURL(/\/circles\/finance-council(\/bulletin)?$/);
  await expect(mira.getByText("E2E budget meeting moved", { exact: true })).toBeVisible();

  const { context: member, page: priya } = await pageFor(browser, PRIYA);
  await priya.goto("/circles/finance-council/bulletin");
  await expect(priya.getByText("E2E budget meeting moved", { exact: true })).toBeVisible();
  await member.close();

  // Carmen isn't in the Finance Council: no Bulletin section, and the post
  // is nowhere in what her browser is sent
  const { context: outsider, page: carmen } = await pageFor(browser, CARMEN);
  await carmen.goto("/circles/finance-council/wiki");
  await expect(carmen.getByText("Finance Council").first()).toBeVisible();
  await expect(carmen.getByRole("link", { name: /Bulletin/ })).toHaveCount(0);
  await carmen.goto("/circles/finance-council/bulletin");
  await expect(carmen.getByText("E2E budget meeting moved")).toHaveCount(0);
  expect(await carmen.content()).not.toContain("E2E budget meeting moved");
  await outsider.close();
});
