import { CIRCLES, EVENTS, MEMBERS, RESOURCES } from "@/lib/data";
import { seedDatabase } from "./seed-core";
import { setAdmins } from "@/lib/db/applications";

/* One-time local dev setup — inserts the demo fixtures from lib/data.ts into
   a fresh Postgres database (after `npm run db:migrate`):

     npm run db:seed

   For the real beta cohort, see scripts/seed-beta.ts instead. */
seedDatabase({ members: MEMBERS, circles: CIRCLES, events: EVENTS, resources: RESOURCES })
  // Felix keeps the node online, so he reviews applications in the demo
  .then(() => setAdmins(MEMBERS.filter((m) => m.id === 8 && m.email).map((m) => m.email!), true))
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
