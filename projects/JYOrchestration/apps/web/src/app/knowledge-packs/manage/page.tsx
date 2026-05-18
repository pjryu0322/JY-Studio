import { Suspense } from "react";
import { LoadingState } from "@/components/ui";
import { KnowledgePacksManagePageClient } from "@/components/knowledge-packs/KnowledgePacksManagePageClient";

export default function KnowledgePacksManagePage() {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        maxHeight: "100dvh",
      }}
    >
      <Suspense fallback={<LoadingState />}>
        <KnowledgePacksManagePageClient />
      </Suspense>
    </div>
  );
}
