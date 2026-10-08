import { LegalHeading, LegalList, LegalParagraph } from "./prose";

/* The short privacy notes for the invitation-only beta, which applicants agree
   to (see ApplyPage's agree step) and /privacy shows. A full privacy policy
   will replace them before Circles opens more widely. They describe what the
   code actually does, so a change to who sees what means changing them too,
   and bumping BETA_AGREEMENT_VERSION. */
export function BetaPrivacy() {
  return (
    <>
      <LegalParagraph>
        This is a short version of how Circles handles your information during the beta.
      </LegalParagraph>

      <LegalHeading>What Circles keeps</LegalHeading>
      <LegalList>
        <li>What you apply with: your name, email, neighborhood, home address and photo, and your mobile number if you give one.</li>
        <li>What you add to your profile, all of it optional: pronouns, occupation, skills, interests and bio.</li>
        <li>What you do in Circles: the circles you belong to, events, RSVPs, votes, bulletin posts and invitations.</li>
        <li>Your sign-ins, including your IP address and browser type, to keep your account secure.</li>
      </LegalList>

      <LegalHeading>Who sees it</LegalHeading>
      <LegalList>
        <li>Nothing is public on the web. Only signed-in members can see anything.</li>
        <li>Every member can see your name, profile, email address (unless you hide it from your profile, when no one else is sent it), neighborhood, the circles you belong to and roles you hold. A private group, and who&apos;s in it, is seen only by its members.</li>
        <li>Your photo is seen by members who share a circle with you, including your neighborhood.</li>
        <li>Events, bulletin posts, and who&apos;s going to or voted for something are seen by the members of the circle they belong to. Votes aren&apos;t secret.</li>
        <li>Your home address is seen only by the person reviewing your application, and deleted once it&apos;s decided.</li>
        <li>Your mobile number is seen by no one else. It&apos;s used only to text you notifications, along with a record of when you agreed to them. Reply STOP to any text, or remove your number in Settings, to stop them.</li>
      </LegalList>

      <LegalHeading>What Circles never does</LegalHeading>
      <LegalParagraph>
        Circles doesn&apos;t sell your information, show ads, use trackers or analytics, or use your information to train AI. Its one cookie keeps you signed in.
      </LegalParagraph>

      <LegalHeading>Who else handles it</LegalHeading>
      <LegalParagraph>
        Railway hosts Circles and its database, Resend delivers its emails, and Twilio delivers its texts. A member who hasn&apos;t uploaded a photo is shown with a placeholder image from pravatar.cc, which sees the viewer&apos;s IP address.
      </LegalParagraph>

      <LegalHeading>Your choices</LegalHeading>
      <LegalParagraph>
        Reach out to the developer to see, correct or get a copy of your information, or to delete your account. You can leave a circle, and add or remove your mobile number, yourself. You&apos;ll hear from the developer before any change to how your information is shared.
      </LegalParagraph>
    </>
  );
}
