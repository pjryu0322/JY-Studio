import { Suspense } from "react";
import { LoadingState } from "@/components/ui";
import { KnowledgePacksManagePageClient } from "@/components/knowledge-packs/KnowledgePacksManagePageClient";

export default function KnowledgePacksManagePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <KnowledgePacksManagePageClient />
    </Suspense>
  );
}
