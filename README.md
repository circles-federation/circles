# Circles

Circles is a coordination tool for neighborhoods. It gives the people who live in a city, and the councils, collectives, co-ops and groups they form, a shared place to organize, and lets each of those circles govern itself directly.

It's developed, maintained and hosted by a worker self-directed nonprofit, and it's free software: anyone can read, run, change and share it.

> **Status:** Early. Circles is heading into a small beta with a single neighborhood, so expect it to change quickly.

## What it does

Many of these features are inspired by [sociocracy](https://www.sociocracyforall.org/sociocracy/), a way of governing an organization through nested, self-governing circles. That's where Circles gets circles inside circles, a circle's Leader, Secretary and Facilitator roles, and marking each agenda topic as Report, Explore or Decide. For now, meetings and proposals are approved by a majority vote. We intend to build more of Circles around consent, sociocracy's way of deciding, where a proposal goes ahead unless someone has a reasoned objection. We'll likely replace majority vote with consent before Circles leaves beta.

- **Circles, all the way down.** The city, its neighborhoods, and every council, collective, co-op and group inside them are the same thing: a circle, which can hold other circles. Each member lives in one neighborhood and can belong to any number of circles.
- **Events.** Members post events to the circles they belong to, and only that circle's members see them. Events can repeat, ask for volunteers to fill set slots, and be added to a calendar.
- **Direct democracy.** A member can propose a meeting, and it's approved once a majority of the circle's members vote for it. Meetings have agendas whose topics are marked Report, Explore or Decide. A circle can also host an event on behalf of its members, which goes to the same kind of vote first.
- **A bulletin for each circle.** Members share links, files and announcements that only the circle can see.
- **Roles, invitations and private groups.** Circles can name a Secretary, Leader and Facilitator, invite people in, and form private groups that only their members know about.
- **Email that respects attention.** Small circles hear about new events right away. Large ones, like a whole neighborhood, get a daily digest instead.
- **Joining by request.** There's no open sign-up. Someone asks to join their neighborhood, and a person reviews the request.

## Built with

Next.js (App Router) and TypeScript, Tailwind CSS, PostgreSQL through Drizzle ORM, passwordless email sign-in with Better Auth, and plain SMTP for email. It's designed to be self-hosted and depends on no proprietary services.

## Running it locally

You'll need Node.js and Docker.

```bash
npm install
cp .env.example .env.local
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Then open http://localhost:3000 and sign in as one of the demo accounts. [CONTRIBUTING.md](CONTRIBUTING.md) explains the rest.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), which covers signing off your commits and making a change. [CLAUDE.md](CLAUDE.md) is the detailed guide to how the app is built.

## License

Circles is licensed under the [GNU Affero General Public License v3.0 or later](LICENSE). If you run a modified version of Circles for other people, you have to offer them its source code too.
