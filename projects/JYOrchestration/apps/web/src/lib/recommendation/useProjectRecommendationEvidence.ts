"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildRecommendationEvidenceItems,
  type RecommendationEvidenceItem,
} from "@/lib/recommendation/recommendationEvidence";
import {
  dispatchRecommendationPanelOpen,
  subscribeRecommendationPanel,
} from "@/lib/recommendation/recommendationPanelEvents";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type UseProjectRecommendationEvidenceInput = Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson: RequirementsStateJson;
  readonly messages?: readonly RequirementsMessage[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly projectDescription?: string;
}>;

export type UseProjectRecommendationEvidenceResult = Readonly<{
  readonly open: boolean;
  readonly items: readonly RecommendationEvidenceItem[];
  readonly close: () => void;
}>;

export function useProjectRecommendationEvidence(
  input: UseProjectRecommendationEvidenceInput,
): UseProjectRecommendationEvidenceResult {
  const [open, setOpen] = useState(false);
  const projectId = input.projectId.trim();

  const items = useMemo(
    () =>
      buildRecommendationEvidenceItems({
        requirementsStateJson: input.requirementsStateJson,
        messages: input.messages,
        projectArtifacts: input.projectArtifacts,
        projectDescription: input.projectDescription,
      }),
    [
      input.requirementsStateJson,
      input.messages,
      input.projectArtifacts,
      input.projectDescription,
    ],
  );

  const close = useCallback(() => {
    setOpen(false);
    if (projectId) dispatchRecommendationPanelOpen(projectId, false);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    return subscribeRecommendationPanel(projectId, setOpen);
  }, [projectId]);

  return { open, items, close };
}
