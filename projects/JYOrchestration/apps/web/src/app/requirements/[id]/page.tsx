import { Suspense } from "react";
import { RequirementDetailPageClient } from "@/app/requirements/[id]/RequirementDetailPageClient";

export default function RequirementDetailPage() {
  return (
    <Suspense fallback={<div />}>
      <RequirementDetailPageClient />
    </Suspense>
  );
}

