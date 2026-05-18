import { Suspense } from "react";
import { PlanningExecutionPageClient } from "@/app/planning-execution/PlanningExecutionPageClient";

/**
 * Planning-originated execution UI skeleton (demo-driven).
 * Data path: normalized response → view-model → screen layout (see component file comments).
 */
export default function PlanningExecutionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-500">불러오는 중…</div>}>
      <PlanningExecutionPageClient />
    </Suspense>
  );
}
