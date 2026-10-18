import { redirect } from "next/navigation";

// the list moved to /admin/review, alongside members' new photos
export default function Page() {
  redirect("/admin/review");
}
