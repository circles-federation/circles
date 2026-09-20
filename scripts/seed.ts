import { CIRCLES, EVENTS, MEMBERS, RESOURCES } from "@/lib/data";
import { seedDatabase } from "./seed-core";

/* One-time local dev setup — inserts the demo fixtures from lib/data.ts into
   a fresh Postgres database (after `npm run db:migrate`):

     npm run db:seed

   For the real beta cohort, see scripts/seed-beta.ts instead. */
seedDatabase({ members: MEMBERS, circles: CIRCLES, events: EVENTS, resources: RESOURCES })
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
