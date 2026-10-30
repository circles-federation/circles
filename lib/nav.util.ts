import { isCircleSection } from "./circles.util";

export type Tab = "/home" | "/circles" | "/events";

/* Which tab a page belongs to, for both navs to highlight (TopBar's tabs on
   desktop, BottomNav on a phone) — one rule, so they can't disagree.

   A page you browse to belongs to its tab: every circle page (however deep,
   since all live under /circles), every event page, and Home along with the
   pages only it leads to (profiles). A page for doing something belongs to
   none, however it was reached, from the top bar's action or a button in the
   page: Settings and its pages, Edit profile, a new circle, a new or edited
   event, a circle's Manage, Invite and bulletin forms, an invitation (to
   accept or decline), an admin's applications (to review), and Hi, neighbor,
   a game that wants the whole screen. */
/* A page that is still its tab's but wants the whole screen, so the bottom nav
   goes while it's open (it slides away as for a page of doing something, see
   AppShell) and its tab stays lit: a circle's chat, whose composer is fixed to
   the foot of the screen. */
export function hidesBottomNav(pathname: string): boolean {
  const [section, , sub, item] = pathname.split("/").slice(1);
  return section === "circles" && sub === "chat" && !item;
}

export function activeTab(pathname: string): Tab | null {
  const [section, id, sub] = pathname.split("/").slice(1);
  switch (section) {
    case "home":
      return "/home";
    case "profile":
      return id === "edit" ? null : "/home";
    case "circles":
      // a circle's sections (/circles/[id]/members…) are its page, not something to do
      return id === "new" || (sub && !isCircleSection(sub)) || pathname.split("/").length > 4 ? null : "/circles";
    case "events":
      return id === "new" || sub ? null : "/events";
    default:
      return null;
  }
}
