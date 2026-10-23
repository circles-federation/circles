"use client";

import { Home } from "@/components/home/home.page";
import { useAppState } from "@/components/providers/app-state-provider";

export default function Page() {
  const { profile, events, rsvpState } = useAppState();
  return <Home profile={profile} events={events} rsvpState={rsvpState} />;
}
