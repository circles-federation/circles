import path from "node:path";
import { defineConfig } from "vitest/config";

// event times are wall-clock in the server's zone (see TZ in the docs), so
// the tests fix one that has daylight saving
process.env.TZ = "America/New_York";

// the database the *.db.test.ts files run against: its own, on the same server
// as development's (docker-compose.yml), dropped and rebuilt on every run, so
// it must never be pointed at a real one
const dbUrl = process.env.TEST_DATABASE_URL ?? "postgres://circles:circles@localhost:5432/circles_test";
const dbName = new URL(dbUrl).pathname.slice(1);
if (!dbName.endsWith("_test")) throw new Error(`Refusing to wipe "${dbName}": a test database's name must end in _test.`);
process.env.TEST_DATABASE_URL = dbUrl;

const alias = { "@": path.resolve(import.meta.dirname) };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", environment: "node", include: ["lib/**/*.test.ts"], exclude: ["lib/**/*.db.test.ts"] },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          environment: "node",
          include: ["lib/**/*.db.test.ts"],
          globalSetup: ["lib/test/db-global-setup.ts"],
          // the files share one database, so they run one after another
          fileParallelism: false,
          env: { DATABASE_URL: dbUrl },
        },
      },
    ],
  },
});
