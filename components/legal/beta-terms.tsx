import { LegalHeading, LegalList, LegalParagraph } from "./prose";

/* The short terms for the invitation-only beta, which applicants agree to
   (see ApplyPage's agree step) and /terms shows. A full terms of use will
   replace them before Circles opens more widely. Changing what they say means
   bumping BETA_AGREEMENT_VERSION, since it records what each applicant agreed to. */
export function BetaTerms() {
  return (
    <>
      <LegalParagraph>
        Circles is in a small, invitation-only beta. These are the short terms for using it while it&apos;s being built. By applying, you agree to them and to the privacy notes.
      </LegalParagraph>

      <LegalHeading>It&apos;s a beta</LegalHeading>
      <LegalList>
        <li>Things will break, and Circles may sometimes be unavailable.</li>
        <li>Features will be added, changed and removed, sometimes without notice. For example, majority voting will likely be replaced by consent.</li>
        <li>Data may be lost or reset, so don&apos;t keep the only copy of anything important in Circles.</li>
        <li>Circles is provided as it is, with no guarantees.</li>
      </LegalList>

      <LegalHeading>Joining</LegalHeading>
      <LegalParagraph>
        You must be 18 or older, live in the neighborhood you apply for, and use your real name and a photo of yourself. One account per person.
      </LegalParagraph>

      <LegalHeading>Being a good neighbor</LegalHeading>
      <LegalList>
        <li>Treat people with respect. No harassment, threats, hate or discrimination.</li>
        <li>What&apos;s shared in a circle stays in that circle. Don&apos;t copy members&apos; information, posts or photos out of Circles without their permission.</li>
        <li>Don&apos;t pretend to be someone else, or post things you know are false.</li>
        <li>No spam or advertising.</li>
        <li>Don&apos;t try to see what you aren&apos;t allowed to, or to break Circles.</li>
      </LegalList>

      <LegalHeading>Your posts and your circles</LegalHeading>
      <LegalParagraph>
        What you post is yours. You let Circles store it and show it to the people you share it with, and nothing more. A circle&apos;s votes are that circle&apos;s own decisions, and whoever organizes an event is responsible for it.
      </LegalParagraph>

      <LegalHeading>Problems and leaving</LegalHeading>
      <LegalParagraph>
        If someone breaks these terms or makes you feel unsafe, reach out to the developer. The developer may remove content, or an account, that breaks them. You can leave Circles at any time by asking the developer.
      </LegalParagraph>

      <LegalHeading>Feedback</LegalHeading>
      <LegalParagraph>
        Your feedback shapes Circles. Tell the developer what works and what doesn&apos;t. Circles is free software, so any improvement you suggest ends up free for everyone.
      </LegalParagraph>
    </>
  );
}
