"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreateCirclePage } from "@/components/circles/create-circle.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { useToast } from "@/components/shared";

function NewCircleRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goBack = useGoBack();
  const { showToast } = useToast();
  const { circles, createCircle } = useAppState();

  return (
    <CreateCirclePage
      circles={circles}
      // ?parent= is the neighborhood whose page Create was pressed on; without
      // it (the Circles root) the form starts with the city
      initialParentId={searchParams.get("parent") ?? undefined}
      // replace, not push: the form is done with, so Back from the new circle
      // shouldn't land on it again
      onCreate={async (input) => {
        const result = await createCircle(input);
        if (!result.ok) return result;
        showToast({ tone: "success", title: "Circle created", message: "Add more about it from Manage circle." });
        router.replace(`/circles/${result.circle.id}`);
        return { ok: true };
      }}
      onBack={goBack}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewCircleRoute />
    </Suspense>
  );
}
