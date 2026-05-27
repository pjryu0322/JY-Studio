"use client";

import { ProjectRightDrawerShell } from "@/components/ui/ProjectRightDrawerShell";
import { RecommendationEvidencePanel } from "@/components/recommendation/RecommendationEvidencePanel";
import type { RecommendationEvidenceItem } from "@/lib/recommendation/recommendationEvidence";

export function RecommendationEvidenceDrawer({
  open,
  items,
  onClose,
  closeOnEscape = true,
}: {
  readonly open: boolean;
  readonly items: readonly RecommendationEvidenceItem[];
  readonly onClose: () => void;
  readonly closeOnEscape?: boolean;
}) {
  return (
    <ProjectRightDrawerShell
      open={open}
      onClose={onClose}
      closeOnEscape={closeOnEscape}
      ariaLabel="AI 추천근거"
      width="min(520px, 100vw)"
    >
      <RecommendationEvidencePanel items={items} onClose={onClose} />
    </ProjectRightDrawerShell>
  );
}
