import path from "node:path";
import { defineConfig } from "vitest/config";

// event times are wall-clock in the server's zone (see TZ in the docs), so
// the tests fix one that has daylight saving
process.env.TZ = "America/New_York";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
