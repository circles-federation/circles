import { describe, expect, it } from "vitest";
import * as format from "./format.util";

describe("format.util", () => {
  it("loads", () => {
    expect(Object.keys(format).length).toBeGreaterThan(0);
  });
});
