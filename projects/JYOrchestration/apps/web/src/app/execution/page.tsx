import { Suspense } from "react";
import { ExecutionPageClient } from "@/app/execution/ExecutionPageClient";

export default function ExecutionPage() {
  return (
    <Suspense fallback={<div />}>
      <ExecutionPageClient />
    </Suspense>
  );
}

