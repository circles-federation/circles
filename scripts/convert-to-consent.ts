import { convertMajorityToConsent } from "@/lib/db/proposals";

/* One-off, for the move from majority votes to consent: every upcoming
   meeting and circle-hosted event still waiting on its votes becomes an open
   consent proposal, its votes counted as consents (see
   convertMajorityToConsent in lib/db/proposals.ts). Run once, after the
   migration that allows an undecided meeting:

     npm run convert-to-consent

   Against production, point DATABASE_URL at it the way migrations are run.
   It skips anything already converted, so running it again is harmless. */
convertMajorityToConsent()
  .then(({ converted, scheduled }) => {
    console.log(`Converted ${converted} to consent proposals; ${scheduled} of them already had everyone's consent and are scheduled.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
