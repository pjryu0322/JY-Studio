"use client";

import { useMemo } from "react";
import { RecommendationEvidenceDrawer } from "@/components/recommendation/RecommendationEvidenceDrawer";
import { RequirementsDeliverableViewerModal } from "@/components/requirements/RequirementsDeliverableViewerModal";
import { projectArtifactToDeliverableAsset } from "@/lib/requirements/projectArtifactViewer";
import type { UsePrototypeImplementationStagePanelResult } from "@/components/preview/usePrototypeImplementationStagePanel";
import type { PrototypeImplementationStageHost } from "@/components/preview/usePrototypeImplementationStagePanel";

export type PrototypeImplementationStageOverlaysProps = Readonly<{
  host: PrototypeImplementationStageHost;
  stage: UsePrototypeImplementationStagePanelResult;
}>;

export function PrototypeImplementationStageOverlays({ host, stage }: PrototypeImplementationStageOverlaysProps) {
  const {
    recommendationEvidence,
    deliverableViewer,
    planningOrchestrationView,
  } = stage;

  const deliverableViewerAssets = useMemo(() => {
    const pid = host.projectId.trim();
    const ids = planningOrchestrationView.deliverableViewerAssetIds;
    const fromDeliverables = planningOrchestrationView.deliverableAssets.filter((a) => ids.includes(a.id));
    const knownIds = new Set(fromDeliverables.map((a) => a.id));
    const extras = ids.flatMap((id) => {
      if (knownIds.has(id)) return [];
      const artifact = planningOrchestrationView.projectArtifacts.find((a) => a.id === id);
      if (!artifact || !pid) return [];
      return [projectArtifactToDeliverableAsset(artifact, pid)];
    });
    const byId = new Map<string, import("@/lib/requirements/ideationDeliverables").IdeationDeliverableAsset>();
    for (const a of [...fromDeliverables, ...extras]) {
      byId.set(a.id, a);
    }
    return [...byId.values()];
  }, [planningOrchestrationView, host.projectId]);

  return (
    <>
      <RecommendationEvidenceDrawer
        open={recommendationEvidence.open}
        items={recommendationEvidence.items}
        onClose={recommendationEvidence.close}
        closeOnEscape={!deliverableViewer.open}
      />

      <RequirementsDeliverableViewerModal
        open={deliverableViewer.open}
        onClose={deliverableViewer.close}
        assets={deliverableViewerAssets}
        initialAssetId={deliverableViewer.focusAssetId}
      />
    </>
  );
}
