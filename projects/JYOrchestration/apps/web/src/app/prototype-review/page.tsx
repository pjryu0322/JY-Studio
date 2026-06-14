import { Suspense } from "react";
import { PrototypeReviewPlaceholderPageClient } from "@/app/prototype-review/PrototypeReviewPlaceholderPageClient";

export default function PrototypeReviewPage() {
  return (
    <Suspense fallback={<div />}>
      <PrototypeReviewPlaceholderPageClient />
    </Suspense>
  );
}
