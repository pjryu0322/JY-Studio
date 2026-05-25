/**
 * 구현(/execution) 화면 — 기획 SingleChat·Artifact Hub 오케스트레이션 읽기 전용 투영.
 */

import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import {
  buildProjectArtifactHubCatalog,
  countCompletedArtifactHubEntries,
  type ProjectArtifactHubEntry,
} from "@/lib/requirements/projectArtifactHub";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { buildOrchestrationUiProjection } from "@/lib/requirements/requirementsOrchestrationUiProjection";
import {
  resolveWorkspaceSingleChatOrchestration,
  shouldShowWorkspaceHubNotificationBadges,
} from "@/lib/requirements/requirementsWorkspaceHelpers";
import { parseRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  buildDynamicServicePlanningSlotDefinitions,
  buildOrchestrationSlotSummarySections,
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  singleChatOrchestrationConfirmedProgress,
  singleChatOrchestrationStatusCounts,
  singleChatOrchestrationWeightedProgress,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import { collectDeliverableViewerAssetIds } from "@/lib/requirements/deliverableAssetPicker";
import type { WorkspaceIdeationInterviewProgressUi } from "@/components/workspace/WorkspaceProgressPill";

export type PrototypeExecutionPlanningOrchestrationView = Readonly<{
  readonly persistedState: RequirementsStateJson;
  readonly deliverableAssets: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly artifactHubCatalog: readonly ProjectArtifactHubEntry[];
  readonly artifactHubCompletedCount: number;
  readonly showArtifactHubBadge: boolean;
  readonly orchestrationUi: ReturnType<typeof buildOrchestrationUiProjection>;
  readonly orchestrationUiState: RequirementsSingleChatOrchestrationStateV1;
  readonly planningProgressUi: WorkspaceIdeationInterviewProgressUi;
  readonly deliverableViewerAssetIds: readonly string[];
}>;

export function buildPrototypeExecutionPlanningOrchestrationView(input: {
  readonly requirementsStateJson: unknown;
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly servicePlanningAgentCatalogKeys?: readonly WorkspaceAiMemberId[] | null;
}): PrototypeExecutionPlanningOrchestrationView {
  const persistedState = parseRequirementsStateJson(input.requirementsStateJson);

  const deliverableAssets = persistedState.deliverableAssets ?? [];
  const projectArtifacts = persistedState.projectArtifacts ?? [];

  const artifactHubCatalog = buildProjectArtifactHubCatalog({
    state: persistedState,
    deliverableAssets,
    projectArtifacts,
  });

  const artifactHubCompletedCount = countCompletedArtifactHubEntries(artifactHubCatalog);

  const slotDefs = buildDynamicServicePlanningSlotDefinitions({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    projectType: null,
    servicePlanningAgentCatalogKeys: input.servicePlanningAgentCatalogKeys ?? null,
  });
  const slotHash = hashSlotDefinitions(slotDefs);

  const orchestrationAligned =
    resolveWorkspaceSingleChatOrchestration({
      localState: persistedState,
      persistedOrchestration: persistedState.singleChatOrchestrationV1,
      slotDefinitionsHash: slotHash,
    }) ?? null;

  const orchestrationUiState =
    orchestrationAligned ?? initialOrchestrationStateFromDefinitions(slotDefs, new Date().toISOString());

  const weighted = singleChatOrchestrationWeightedProgress(orchestrationUiState);
  const confirmed = singleChatOrchestrationConfirmedProgress(orchestrationUiState);
  const statusCounts = singleChatOrchestrationStatusCounts(orchestrationUiState);
  const slotSections = buildOrchestrationSlotSummarySections(slotDefs, orchestrationUiState);

  const showArtifactHubBadge = shouldShowWorkspaceHubNotificationBadges({
    readinessPercent: weighted.percent,
    statusCounts,
  });

  const orchestrationUi = buildOrchestrationUiProjection({
    state: persistedState,
    catalogCount: artifactHubCatalog.length,
  });

  const planningProgressUi: WorkspaceIdeationInterviewProgressUi = {
    active: showArtifactHubBadge,
    readinessPercent: weighted.percent,
    covered: confirmed.confirmed,
    total: confirmed.total,
    statusCounts,
    remainingQuestionsEstimate: Math.max(0, confirmed.total - confirmed.confirmed),
    onForceGeneratePlanNow: () => {},
    orchestrationSlotSections: slotSections,
  };

  const deliverableViewerAssetIds = collectDeliverableViewerAssetIds({
    deliverableAssets,
    projectArtifacts,
    projectId: input.projectId.trim(),
  });

  return {
    persistedState,
    deliverableAssets,
    projectArtifacts,
    artifactHubCatalog,
    artifactHubCompletedCount,
    showArtifactHubBadge,
    orchestrationUi,
    orchestrationUiState,
    planningProgressUi,
    deliverableViewerAssetIds,
  };
}
