"use client";

import { PageContainer } from "@/components/shared";
import type { Circle } from "@/lib/types";
import { InvitePicker } from "./invite-picker";

// inviting people to a circle on a phone — the page InviteModal becomes there;
// leaving is the top bar's Back, since each invitation is sent as it's made
export function InvitePage({ circle }: { circle: Circle }) {
  return (
    <PageContainer size="compact">
      <InvitePicker circle={circle} />
    </PageContainer>
  );
}
