"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { ManageCirclePage } from "@/components/circles/manage-circle.page";
import { useAppState } from "@/components/providers/app-state-provider";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { circles, saveCircle } = useAppState();

  const circle = circles.find((c) => c.id === id);
  if (!circle) notFound();

  return (
    <ManageCirclePage
      circle={circle}
      circles={circles}
      onSave={(patch) => saveCircle(circle.id, patch)}
      onBack={() => router.back()}
    />
  );
}
