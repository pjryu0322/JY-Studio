import { Suspense } from "react";
import { LoadingState } from "@/components/ui";
import { KnowledgePacksDetailWindow } from "@/components/knowledge-packs/KnowledgePacksDetailWindow";

export default function KnowledgePackDetailPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <KnowledgePacksDetailWindow />
    </Suspense>
  );
}
