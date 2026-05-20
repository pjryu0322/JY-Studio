/**
 * UI projection adapter — maps slim read model to legacy OrchestrationUiProjection shape.
 */

import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { buildOrchestrationReadModel } from "@/lib/requirements/requirementsOrchestrationReadModel";

export type {
  FocusDriftUiBanner,
  ClarificationUiState,
  OrchestrationRecommendationUi,
  ArtifactLifecycleUiLabel,
} from "@/lib/requirements/requirementsOrchestrationUiProjectionTypes";

export {
  buildClarificationUserMessage,
  artifactLifecycleUiLabel,
  artifactLifecycleLabelKo,
} from "@/lib/requirements/requirementsOrchestrationUiProjectionTypes";

import type {
  ArtifactLifecycleUiLabel,
  ClarificationUiState,
  FocusDriftUiBanner,
  OrchestrationRecommendationUi,
} from "@/lib/requirements/requirementsOrchestrationUiProjectionTypes";

export type OrchestrationUiProjection = Readonly<{
  readonly focusDrift: FocusDriftUiBanner | null;
  readonly clarification: ClarificationUiState | null;
  readonly topRecommendation: OrchestrationRecommendationUi | null;
  readonly secondaryRecommendationReasons: readonly string[];
  readonly artifactBadgeCount: number;
  readonly artifactBadgeHasStale: boolean;
  readonly artifactLifecycleLabels: readonly Readonly<{
    readonly key: string;
    readonly label: ArtifactLifecycleUiLabel;
    readonly hint: string;
  }>[];
  readonly humanReadableDebugSummary: string | null;
  readonly artifactPropagation: readonly string[];
}>;

export function buildOrchestrationUiProjection(input: {
  readonly state: RequirementsStateJson;
  readonly catalogCount?: number;
  readonly drawerFeatureId?: string | null;
}): OrchestrationUiProjection {
  const rm = buildOrchestrationReadModel(input);
  return {
    focusDrift: rm.focusDriftBanner,
    clarification: rm.clarificationBanner,
    topRecommendation: rm.topRecommendation,
    secondaryRecommendationReasons: rm.secondaryRecommendationReasons,
    artifactBadgeCount: rm.artifactBadge.count,
    artifactBadgeHasStale: rm.artifactBadge.hasStale,
    artifactLifecycleLabels: rm.artifactLifecycleHints,
    humanReadableDebugSummary: rm.humanReadableDebugSummary,
    artifactPropagation: rm.artifactPropagation,
  };
}
