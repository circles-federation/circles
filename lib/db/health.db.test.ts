import { describe, expect, it } from "vitest";
import { databaseIsUp } from "./health";

describe("databaseIsUp", () => {
  it("is true while the database answers", async () => {
    expect(await databaseIsUp()).toBe(true);
  });
});
