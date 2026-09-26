import { readFileSync } from "node:fs";
import { count } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { members as membersTable } from "@/lib/db/schema";
import { assembleCircleRoles, validateCircleRoles, type CircleRoleDraft } from "@/lib/circle-roles.util";
import type { Circle, Member } from "@/lib/types";
import { seedDatabase } from "./seed-core";

/* Seeds the live beta: one city, one neighborhood inside it, one council
   inside that, and the people who live there — read from a JSON file that
   holds real names and emails and so is deliberately NOT committed (see
   .gitignore; seed/beta.example.json documents the shape with fake data):

     npm run db:seed:beta                      # reads seed/beta.json
     npm run db:seed:beta -- path/to/file.json

   Every person becomes a resident of the neighborhood (their home circle),
   and everyone marked "inCouncil" is a member of the council (who may also
   hold roles there, via "councilRoles": Secretary, Leader and Facilitator, or
   any name you like). Every person
   also gets a login (a Better Auth user for their email) — sign-up is off,
   so this is the only way anyone can sign in. Refuses to run against a
   database that already has members, rather than mixing real and existing
   rows. */

interface BetaCircle {
  name: string;
  tagline: string;
  about: string;
}

interface BetaPerson {
  name: string;
  lastName?: string;
  pronouns?: string;
  role?: string;
  email: string;
  bio?: string;
  skills?: string[];
  interests?: string[];
  inCouncil?: boolean;
  // roles this person holds on the council — one holder per role
  councilRoles?: string[];
}

interface BetaFile {
  city: { name: string };
  neighborhood: BetaCircle;
  council: BetaCircle;
  people: BetaPerson[];
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// each named role and the person (by their member id, i + 1) who holds it
function councilRoleDrafts(f: BetaFile): CircleRoleDraft[] {
  return (f.people ?? []).flatMap((p, i) => (Array.isArray(p?.councilRoles) ? p.councilRoles.map((label) => ({ label, memberId: i + 1 })) : []));
}

function validate(f: BetaFile): string[] {
  const errors: string[] = [];
  const text = (v: unknown) => typeof v === "string" && v.trim() !== "";
  if (!text(f?.city?.name)) errors.push("city.name is required");
  for (const key of ["neighborhood", "council"] as const) {
    for (const field of ["name", "tagline", "about"] as const) {
      if (!text(f?.[key]?.[field])) errors.push(`${key}.${field} is required`);
    }
  }
  if (!Array.isArray(f?.people) || f.people.length === 0) {
    errors.push("people must be a non-empty array");
    return errors;
  }
  const seen = new Set<string>();
  f.people.forEach((p, i) => {
    const label = `people[${i}]${p?.name ? ` (${p.name})` : ""}`;
    if (!text(p?.name)) errors.push(`${label}: name is required`);
    if (!text(p?.email) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) errors.push(`${label}: a valid email is required — it's how they sign in`);
    else if (seen.has(p.email.trim().toLowerCase())) errors.push(`${label}: duplicate email`);
    else seen.add(p.email.trim().toLowerCase());
    if (p?.councilRoles !== undefined && (!Array.isArray(p.councilRoles) || p.councilRoles.some((r) => typeof r !== "string"))) {
      errors.push(`${label}: councilRoles must be a list of role names`);
    } else if (p?.councilRoles?.length && !p.inCouncil) {
      errors.push(`${label}: councilRoles only makes sense for someone who is "inCouncil"`);
    }
  });
  const roleProblem = validateCircleRoles(councilRoleDrafts(f), f.people.map((_, i) => i + 1));
  if (roleProblem) errors.push(`councilRoles: ${roleProblem}`);
  if (!f.people.some((p) => p?.inCouncil)) errors.push('at least one person needs "inCouncil": true');
  return errors;
}

async function seedBeta() {
  const path = process.argv[2] || "seed/beta.json";
  let file: BetaFile;
  try {
    file = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`Couldn't read ${path} (${err instanceof Error ? err.message : err}). Copy seed/beta.example.json to seed/beta.json and fill it in.`);
  }
  const errors = validate(file);
  if (errors.length > 0) throw new Error(`${path} has problems:\n  - ${errors.join("\n  - ")}`);

  const [existing] = await db.select({ n: count() }).from(membersTable);
  if (existing && existing.n > 0) {
    throw new Error("The database already has members — refusing to seed on top of it. Reset it first (locally: `docker compose down -v`, then `docker compose up -d` and `npm run db:migrate`).");
  }

  const cityId = slug(file.city.name);
  const hoodId = slug(file.neighborhood.name);
  const councilId = slug(file.council.name) === hoodId ? `${slug(file.council.name)}-council` : slug(file.council.name);
  if (new Set([cityId, hoodId, councilId]).size !== 3) throw new Error("The city, neighborhood, and council need distinct names.");

  const members: Member[] = file.people.map((p, i) => ({
    id: i + 1,
    name: p.name.trim(),
    lastName: p.lastName?.trim() || undefined,
    pronouns: p.pronouns ?? "",
    role: p.role ?? "",
    homeCircleId: hoodId,
    skills: p.skills ?? [],
    interests: p.interests ?? [],
    bio: p.bio ?? "",
    email: p.email.trim().toLowerCase(),
  }));
  const councilMemberIds = members.filter((_, i) => file.people[i]!.inCouncil).map((m) => m.id);

  const base = { offers: [], needs: [], facts: [] as [string, string][] };
  const circles: Circle[] = [
    { ...base, id: cityId, type: "other", name: file.city.name.trim(), parentId: null, tagline: `${file.city.name.trim()}, together.`, about: "The root circle — every neighborhood and citywide group sits inside it.", members: [] },
    { ...base, id: hoodId, type: "neighborhood", name: file.neighborhood.name.trim(), parentId: cityId, tagline: file.neighborhood.tagline, about: file.neighborhood.about, members: members.map((m) => m.id) },
    { ...base, id: councilId, type: "circle", name: file.council.name.trim(), parentId: hoodId, tagline: file.council.tagline, about: file.council.about, members: councilMemberIds, roles: assembleCircleRoles(councilRoleDrafts(file), councilMemberIds) },
  ];

  await seedDatabase({ members, circles, events: [] });
  console.log(`\nDone: ${members.length} people in "${file.neighborhood.name}", ${councilMemberIds.length} on "${file.council.name}". Each can sign in with their email (no email provider is wired up yet, so the login code is only shown on-screen in dev).`);
}

seedBeta()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
