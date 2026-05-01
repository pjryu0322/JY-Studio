"use client";

import { Suspense } from "react";
import { PrototypeReviewPageClient } from "@/app/prototype-review/PrototypeReviewPageClient";

export default function PrototypeReviewPage() {
  return (
    <Suspense fallback={null}>
      <PrototypeReviewPageClient />
    </Suspense>
  );
}
