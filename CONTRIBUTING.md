# Contributing to Circles

Thanks for helping build Circles. It's developed, maintained and hosted by a worker self-directed nonprofit, and it's meant to belong to the communities that use it. Contributions of every size are welcome, from fixing a typo to building a feature.

## License

Circles is free software under the [GNU Affero General Public License, version 3 or later](LICENSE). Anything you contribute is released under that same license. You keep the copyright to your work, and you aren't asked to sign it over to anyone. Because copyright stays with everyone who contributed, no one, including the nonprofit, can later take Circles proprietary.

The AGPL also covers running Circles as a hosted service. If you run a modified version for other people over a network, you have to offer those people its source code.

## Sign off your commits

Instead of a contributor agreement, we use the [Developer Certificate of Origin](https://developercertificate.org/) (DCO). By adding a `Signed-off-by` line to a commit, you certify that you wrote the change, or otherwise have the right to submit it under this project's license:

```
Signed-off-by: Your Name <you@example.com>
```

`git commit -s` adds the line for you, using the name and email in your git config. Every commit in a pull request needs one. If you forget, `git commit --amend -s` fixes your last commit, and `git rebase --signoff main` fixes all of them.

<details>
<summary>The full text of the Developer Certificate of Origin</summary>

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

</details>

## Running it locally

You'll need Node.js and Docker.

```bash
npm install
cp .env.example .env.local
docker compose up -d      # Postgres, plus Mailpit to catch outgoing email
npm run db:migrate
npm run db:seed           # demo members, circles and events
npm run dev
```

Open http://localhost:3000 and sign in as one of the demo accounts listed on the welcome page. In development, the login code appears on the page itself. Every email the app sends, including login codes, can be read in Mailpit at http://localhost:8025.

## Making a change

- Read [CLAUDE.md](CLAUDE.md) first. Despite its name, it's the project's architecture guide and style guide, and it explains the rules the code relies on: who can see what, how votes approve an event, and where each kind of logic lives.
- Before opening a pull request, run `npm run lint` and `npm run build`. There's no test suite yet, so the build is the main check that nothing broke. Try your change in the running app too.
- If you change `lib/db/schema.ts`, run `npm run db:generate` and commit the migration it writes to `drizzle/`.
- Keep a pull request to one change, and describe what it does and why.
- Never commit real people's names, emails or addresses. `seed/beta.json` is gitignored for that reason.

For anything bigger than a small fix, open an issue first so we can agree on the approach before you put time into it.

## Reporting a security problem

Please don't open a public issue for a vulnerability. Contact the maintainers privately, so that it can be fixed before it's disclosed.
