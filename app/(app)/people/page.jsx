import { redirect } from "next/navigation";

// People and Organizations merged into one unified Directory — see
// components/directory/browse.page.jsx.
export default function Page() {
  redirect("/directory");
}
