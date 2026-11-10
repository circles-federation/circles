import { redirect } from "next/navigation";

// the old address of /join, still on printed posters and shared links
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => (v === undefined ? [] : [[k, v]])));
  redirect(query.size ? `/join?${query}` : "/join");
}
