"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui";
import { MessengerHome } from "@/components/messenger/MessengerHome";

export function HomePageClient() {
  return (
    <Suspense fallback={<LoadingState />}>
      <MessengerHome />
    </Suspense>
  );
}
