import { Suspense } from "react";
import { LoadingState } from "@/components/ui";
import { KnowledgePacksAgentMappingPageClient } from "@/components/knowledge-packs/KnowledgePacksAgentMappingPageClient";

export default function KnowledgePacksAgentMappingPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <KnowledgePacksAgentMappingPageClient />
    </Suspense>
  );
}
