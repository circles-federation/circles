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
        <li>What you apply with: your name, email, neighborhood and photo.</li>
        <li>What you add to your profile, all of it optional: pronouns, occupation, skills, interests and bio.</li>
        <li>When you can do meetings, if you choose to say (in Settings).</li>
        <li>What you do in Circles: the circles you belong to, events, RSVPs, your answers to proposals, bulletin posts and invitations.</li>
        <li>Messages you write to a circle&apos;s Inbox, with the email address you agree to be answered at.</li>
        <li>If you RSVP to an event someone shared with you, without an account: your name and email address, and which member shared the link with you. To limit abuse, a scrambled (hashed) form of your IP address is kept for a day, only to count how many codes one connection asks for.</li>
        <li>Your sign-ins, including your IP address and browser type, to keep your account secure.</li>
      </LegalList>

      <LegalHeading>Who sees it</LegalHeading>
      <LegalList>
        <li>Only signed-in members can see anything, with two exceptions. A circle&apos;s wiki (what its Wiki tab shows: its name, tagline, about, what it offers and needs, its website, address and contact, hours and how to join) can be read by anyone with its link, signed in or not, and search engines like Google may list it; it never shows the circle&apos;s members or who edited it, and private groups have none. And a member can share an event by link. Anyone with the link, signed in or not, sees that event&apos;s page: its title, time, place and description, who is hosting it and the first names of the people going, with no photos and no way to open their profiles. That includes an event shown only to a private group, though the page never names the group. Search engines are asked not to list these pages.</li>
        <li>Every member can see your name, profile, email address (unless you hide it from your profile, when no one else is sent it), neighborhood, the circles you belong to and roles you hold. A private group, and who&apos;s in it, is seen only by its members.</li>
        <li>Your photo is seen by members who share a circle with you, including your neighborhood.</li>
        <li>When you can do meetings isn&apos;t shown to anyone as a schedule. When a member of one of your circles plans a meeting, they see whether you can make the time they pick, and until when you&apos;re free if you&apos;re free as it begins.</li>
        <li>Events, bulletin posts, a circle&apos;s tasks (and who they&apos;re assigned to), and who&apos;s going to something are seen by the members of the circle they belong to. A post a circle puts on its neighborhood&apos;s bulletin is seen by everyone who lives there. Answers to a proposal aren&apos;t secret: everyone with a say in it sees who answered what, and why anyone objected. For a proposal a neighborhood decides, like a new circle in it, that&apos;s everyone who lives there.</li>
        <li>A message you write to a circle&apos;s Inbox is seen only by that circle&apos;s members, with your name and email address (even if you hide your email from your profile), since you agree to be answered there when you send it. Its members see who among them is handling it.</li>
        <li>If you RSVP as a guest, your first name is shown on that event&apos;s page, to the members who can see the event and to anyone with the link. Your email address is shown to no one. It&apos;s used to check the address is yours, to confirm your RSVP, and to email you if the event is moved or cancelled. Every email to you has a link to stop them, or to come off the list and have your name and email deleted. You can also take your RSVP back from the event page. Otherwise your name and email are deleted 30 days after the event.</li>
        <li>If you then apply to join, the admin reviewing your application sees which member invited you and through which event. Your guest RSVPs to events open to your neighborhood or the whole city become ordinary RSVPs once you&apos;re a member.</li>
        <li>Your application photo is seen only by the person reviewing it, and is no longer kept with the application once it&apos;s decided.</li>
        <li>When you change your photo, a Circles admin sees the new one, beside your current one, before anyone else does. Others keep seeing your current photo until it&apos;s approved, and a declined one is deleted.</li>
      </LegalList>

      <LegalHeading>What Circles never does</LegalHeading>
      <LegalParagraph>
        Circles doesn&apos;t sell your information, show ads, use trackers or analytics, or use your information to train AI. Its cookies keep you signed in and, if you RSVP as a guest, remember on that device that you did.
      </LegalParagraph>

      <LegalHeading>Who else handles it</LegalHeading>
      <LegalParagraph>
        Railway hosts Circles and its database, and Resend delivers its emails. A member who hasn&apos;t uploaded a photo is shown with a placeholder image from pravatar.cc, which sees the viewer&apos;s IP address.
      </LegalParagraph>

      <LegalHeading>Your choices</LegalHeading>
      <LegalParagraph>
        Reach out to the developer to see, correct or get a copy of your information, to leave a circle, or to delete your account. You&apos;ll hear from the developer before any change to how your information is shared.
      </LegalParagraph>
    </>
  );
}
