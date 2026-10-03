export type Tab = "/home" | "/circles" | "/events";

/* Which tab a page belongs to, for both navs to highlight (TopBar's tabs on
   desktop, BottomNav on a phone) — one rule, so they can't disagree.

   A page you browse to belongs to its tab: every circle page (however deep,
   since all live under /circles), every event page, and Home along with the
   pages only it leads to (the name game, profiles, applications). A page for
   doing something belongs to none, however it was reached, from the top
   bar's action or a button in the page: Settings and its pages, Edit
   profile, a new or edited event, a circle's Manage, Invite and bulletin
   forms, and an invitation (to accept or decline). */
export function activeTab(pathname: string): Tab | null {
  const [section, id, sub] = pathname.split("/").slice(1);
  switch (section) {
    case "home":
    case "game":
    case "admin":
      return "/home";
    case "profile":
      return id === "edit" ? null : "/home";
    case "circles":
      return sub ? null : "/circles";
    case "events":
      return id === "new" || sub ? null : "/events";
    default:
      return null;
  }
}
