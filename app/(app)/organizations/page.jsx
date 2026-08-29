import { redirect } from "next/navigation";

// People and Organizations merged into one unified Directory — see
// components/directory/city-directory.page.jsx and neighborhood-directory.page.jsx.
// Individual org pages still live at /organizations/[id] (see that route
// and lib/hooks.js's openOrg).
export default function Page() {
  redirect("/directory");
}
