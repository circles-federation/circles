"use client";

import { Suspense } from "react";
import { CircleRoute } from "../circle-route";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CircleRoute section="tasks" />
    </Suspense>
  );
}
