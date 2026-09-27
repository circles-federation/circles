import { setAdmins } from "@/lib/db/applications";

/* Makes members system admins (who review applications), or stops them being
   one, by email:

     npm run admin -- add ada@example.com
     npm run admin -- remove ada@example.com

   Against production, point DATABASE_URL at it the way migrations are run. */
async function main() {
  const [command, ...emails] = process.argv.slice(2);
  if ((command !== "add" && command !== "remove") || emails.length === 0) {
    console.error("Usage: npm run admin -- add|remove email [email ...]");
    process.exit(1);
  }
  const changed = await setAdmins(emails, command === "add");
  const missed = emails.filter((e) => !changed.some((c) => c.toLowerCase() === e.trim().toLowerCase()));
  for (const e of changed) console.log(`${command === "add" ? "Now an admin" : "No longer an admin"}: ${e}`);
  for (const e of missed) console.log(`No member with the email ${e}`);
  process.exit(missed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
