"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TemplateBuilder from "@/components/templateBuilder/TemplateBuilder";

function TemplateBuilderInner() {
  const params = useSearchParams();
  const jobId = params.get("jobId") ?? "";
  const family = params.get("family") ?? "default/general";
  return <TemplateBuilder jobId={jobId} family={family} />;
}

export default function TemplateBuilderPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading builder...</div>}>
      <TemplateBuilderInner />
    </Suspense>
  );
}

