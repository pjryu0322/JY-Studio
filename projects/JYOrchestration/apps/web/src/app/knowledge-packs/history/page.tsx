import { Suspense } from "react";
import { LoadingState } from "@/components/ui";
import { KnowledgePacksHistoryPageClient } from "@/components/knowledge-packs/KnowledgePacksHistoryPageClient";

export default function KnowledgePacksHistoryPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <KnowledgePacksHistoryPageClient />
    </Suspense>
  );
}
