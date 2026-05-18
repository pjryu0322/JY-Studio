import { Suspense } from "react";
import { PilotValidationPageClient } from "@/app/pilot-validation/PilotValidationPageClient";

export default function PilotValidationPage() {
  return (
    <Suspense fallback={null}>
      <PilotValidationPageClient />
    </Suspense>
  );
}
