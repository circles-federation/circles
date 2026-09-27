import { ApplyPage } from "@/components/welcome/apply.page";
import { getNeighborhoodsForApplying } from "@/lib/db/applications";

// the neighborhoods are read per request, so a new one is offered at once
export const dynamic = "force-dynamic";

// applying to join — public, like the welcome page (proxy.ts lets it through)
export default async function Page() {
  return <ApplyPage neighborhoods={await getNeighborhoodsForApplying()} />;
}
