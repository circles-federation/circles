import { expect, test } from "@playwright/test";
import { MIRA, pageFor } from "./helpers";

const PRIYA = "sw5hfa5t@duck.com";
// under way whenever this runs (e2e/setup-db.ts); Mira is the Finance Council's Facilitator
const MEETING = "/events/e2e-live-meeting";

test("a circle holds a meeting together, live, and corrects its minutes", async ({ browser }) => {
  const mira = await pageFor(browser, MIRA);
  const priya = await pageFor(browser, PRIYA);
  const m = mira.page;
  const p = priya.page;

  // Mira runs it, as the circle's Facilitator
  await m.goto(MEETING);
  await m.getByRole("button", { name: "Run meeting" }).click();
  await expect(m).toHaveURL(/\/live$/);
  await expect(m.getByText("You’re the facilitator")).toBeVisible();

  // Priya sees it going, joins, and marks herself present: Mira sees it at once
  await p.goto(MEETING);
  await expect(p.getByText("Meeting in progress")).toBeVisible();
  await p.getByRole("button", { name: "Join meeting" }).click();
  await expect(p).toHaveURL(/\/live$/);
  await expect(p.getByText("Mira is the facilitator")).toBeVisible();
  await p.getByRole("button", { name: /Priya/ }).click();
  await expect(m.getByRole("button", { name: /Priya/, pressed: true })).toBeVisible();

  // the facilitator moves on and everyone follows
  await m.getByRole("button", { name: "Next step" }).click();
  await expect(p.getByText("Read it through")).toBeVisible();

  // Priya adds a topic to the agenda, and Mira sees it
  await p.getByLabel("New topic title").fill("Winter coats");
  await p.getByRole("button", { name: "Add topic" }).click();
  await expect(m.getByText("Winter coats")).toBeVisible();
  await expect(m.getByText("Agenda · 3")).toBeVisible();

  // Mira takes notes on the first topic; Priya, not typing, sees them arrive
  await m.getByRole("button", { name: "Next step" }).click();
  await expect(p.getByText("Treasurer's report")).toBeVisible();
  await m.locator(".cm-content").first().click();
  await m.keyboard.type("Balance is healthy.");
  await m.getByRole("heading", { name: "Treasurer's report" }).click();
  await expect(m.getByText("Saved")).toBeVisible();
  await expect(p.getByText("Balance is healthy.")).toBeVisible();

  // Priya adds a task out of the meeting; Mira sees it
  await m.getByRole("button", { name: "Tasks", exact: true }).click();
  await p.getByLabel("Title").fill("Book the hall");
  await p.getByRole("button", { name: "Add task" }).click();
  await expect(m.getByRole("link", { name: "Book the hall" })).toBeVisible();

  // Mira finishes it; Priya sees it's finished
  await m.getByRole("button", { name: "Wrap-up" }).click();
  await m.getByRole("button", { name: "Finish meeting" }).click();
  await m.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(p.getByText("This meeting has finished.")).toBeVisible();

  // the minutes are on the event's page, and any member can correct them
  await p.goto(MEETING);
  await expect(p.getByText("Balance is healthy.")).toBeVisible();
  await expect(p.getByText("Book the hall")).toBeVisible();
  await p.getByRole("button", { name: "More" }).click();
  await p.getByRole("menuitem", { name: "Edit minutes" }).click();
  await expect(p).toHaveURL(/\/minutes$/);
  await p.locator(".cm-content").nth(1).click();
  await p.keyboard.type("Consented, no objections.");
  await p.getByRole("button", { name: "Save minutes" }).click();
  await expect(p).toHaveURL(/\/events\/e2e-live-meeting$/);
  await expect(p.getByText("Consented, no objections.")).toBeVisible();
  await expect(p.getByText(/Last edited by Priya/)).toBeVisible();

  await mira.context.close();
  await priya.context.close();
});
