import { Suspense } from "react";
import { PromptTimelinePageClient } from "@/components/debug/PromptTimelinePageClient";

export default function PromptTimelinePage() {
  return (
    <Suspense fallback={null}>
      <PromptTimelinePageClient />
    </Suspense>
  );
}

