import { Suspense } from "react";
import { WorkNotesPageClient } from "@/components/worknote/WorkNotesPageClient";

export default function WorkNotesPage() {
  return (
    <Suspense
      fallback={
        <main style={{ flex: "1 1 auto", minHeight: 0, padding: 16, color: "#64748b" }}>
          불러오는 중…
        </main>
      }
    >
      <WorkNotesPageClient />
    </Suspense>
  );
}
