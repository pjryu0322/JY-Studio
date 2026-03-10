"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TemplateBuilder from "@/components/templateBuilder/TemplateBuilder";
import ScreenLabel from "@/components/entry/ScreenLabel";

function TemplateBuilderInner() {
  const params = useSearchParams();
  const jobId = params.get("jobId") ?? "";
  const family = params.get("family") ?? "default/general";
  return <TemplateBuilder jobId={jobId} family={family} />;
}

export default function TemplateBuilderPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", gap: 10, padding: 16 }}>
      <div style={{ maxWidth: 1240, width: "100%", margin: "0 auto" }}>
        <ScreenLabel screen="템플릿 빌더" mode="Manager" context="추천/드리프트/운영 관리" />
      </div>
      <Suspense fallback={<div style={{ padding: 16 }}>Loading builder...</div>}>
        <TemplateBuilderInner />
      </Suspense>
    </main>
  );
}

