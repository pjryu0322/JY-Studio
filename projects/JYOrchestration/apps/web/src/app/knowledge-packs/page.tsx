import { Suspense } from "react";
import { LoadingState } from "@/components/ui";
import { KnowledgePacksPageClient } from "@/components/knowledge-packs/KnowledgePacksPageClient";

export default function KnowledgePacksPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <KnowledgePacksPageClient />
    </Suspense>
  );
}
