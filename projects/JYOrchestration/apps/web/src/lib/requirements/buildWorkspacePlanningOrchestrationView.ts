/**
 * 기획 워크스페이스·구현 화면 공통 — SingleChat 슬롯·Artifact Hub·오케스트레이션 UI 읽기 모델.
 */

import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { WorkspaceIdeationInterviewProgressUi } from "@/components/workspace/WorkspaceProgressPill";
import { buildArtifactHubBundle, type ArtifactHubBundle } from "@/lib/requirements/artifactHubBundle";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { collectDeliverableViewerAssetIds } from "@/lib/requirements/deliverableAssetPicker";
import { buildOrchestrationUiProjection } from "@/lib/requirements/requirementsOrchestrationUiProjection";
import {
  resolveWorkspaceSingleChatOrchestration,
  shouldShowWorkspaceHubNotificationBadges,
} from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  buildDynamicServicePlanningSlotDefinitions,
  buildOrchestrationSlotSummarySections,
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  singleChatOrchestrationConfirmedProgress,
  singleChatOrchestrationStatusCounts,
  singleChatOrchestrationWeightedProgress,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { planningDataSlotSummaryRows } from "@/lib/planning/planningDataSlotsV1";
import { parsePlanningDataSlotsV1 } from "@/lib/planning/planningDataSlotsV1";
import { buildPlanningDataSlotsStatePatch, resolvePlanningRepositoryName } from "@/lib/planning/planningDataSlotsStatePatch";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";

export type WorkspacePlanningOrchestrationView = Readonly<{
  readonly slotDefs: ReturnType<typeof buildDynamicServicePlanningSlotDefinitions>;
  readonly slotDefsHash: string;
  readonly orchestrationAlignedState: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly orchestrationUiState: RequirementsSingleChatOrchestrationStateV1;
  readonly orchestrationConfirmedMetrics: ReturnType<typeof singleChatOrchestrationConfirmedProgress>;
  readonly orchestrationWeightedMetrics: ReturnType<typeof singleChatOrchestrationWeightedProgress>;
  readonly orchestrationStatusCounts: ReturnType<typeof singleChatOrchestrationStatusCounts>;
  readonly orchestrationSlotSections: ReturnType<typeof buildOrchestrationSlotSummarySections>;
  readonly planningDataSlotSections: readonly import("@/lib/requirements/singleChatOrchestrationSlots").OrchestrationSlotSummarySection[];
  readonly showWorkspaceHubBadges: boolean;
  readonly planningArtifactHub: ArtifactHubBundle;
  readonly orchestrationUi: ReturnType<typeof buildOrchestrationUiProjection>;
  readonly deliverableViewerAssetIds: readonly string[];
  readonly deliverableAssets: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts: readonly ProjectArtifact[];
}>;

export function buildWorkspacePlanningOrchestrationView(input: {
  readonly state: RequirementsStateJson;
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly projectType?: string | null;
  readonly gitRepoName?: string | null;
  readonly servicePlanningAgentCatalogKeys?: readonly WorkspaceAiMemberId[] | null;
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
  /** Workspace: feature-detail 병합 후 readiness (미지정 시 슬롯 가중치 percent) */
  readonly readinessPercentForBadges?: number;
  /** intent orchestration merge가 반영된 state (미지정 시 state 사용) */
  readonly orchestrationProjectionState?: RequirementsStateJson;
  readonly nowIso?: string;
}): WorkspacePlanningOrchestrationView {
  const deliverableAssets = input.deliverableAssets ?? input.state.deliverableAssets ?? [];
  const projectArtifacts = input.projectArtifacts ?? input.state.projectArtifacts ?? [];
  const nowIso = input.nowIso ?? new Date().toISOString();

  const slotDefs = buildDynamicServicePlanningSlotDefinitions({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    projectType: input.projectType ?? null,
    servicePlanningAgentCatalogKeys: input.servicePlanningAgentCatalogKeys ?? null,
  });
  const slotDefsHash = hashSlotDefinitions(slotDefs);

  const orchestrationAlignedState =
    resolveWorkspaceSingleChatOrchestration({
      localState: input.state,
      persistedOrchestration: input.state.singleChatOrchestrationV1,
      slotDefinitionsHash: slotDefsHash,
    }) ?? null;

  const orchestrationUiState =
    orchestrationAlignedState ?? initialOrchestrationStateFromDefinitions(slotDefs, nowIso);

  const orchestrationConfirmedMetrics = singleChatOrchestrationConfirmedProgress(orchestrationUiState);
  const orchestrationWeightedMetrics = singleChatOrchestrationWeightedProgress(orchestrationUiState);
  const orchestrationStatusCounts = singleChatOrchestrationStatusCounts(orchestrationUiState);
  const orchestrationSlotSections = buildOrchestrationSlotSummarySections(slotDefs, orchestrationUiState);

  const repositoryName = resolvePlanningRepositoryName({
    gitRepoName: input.gitRepoName,
    projectName: input.projectName,
  });
  const planningDataSlots =
    parsePlanningDataSlotsV1(input.state.planningDataSlotsV1) ??
    buildPlanningDataSlotsStatePatch({
      state: input.state,
      projectId: input.projectId,
      repositoryName,
      orchestration: orchestrationUiState,
      definitions: slotDefs,
      sampleDataSpecV1: input.state.sampleDataSpecV1 ?? null,
      nowIso,
    }).planningDataSlotsV1;
  const planningDataSlotSections = [
    {
      sectionTitle: "데이터",
      slots: [...planningDataSlotSummaryRows(planningDataSlots)],
    },
  ] as const;

  const readinessPercent =
    input.readinessPercentForBadges ?? orchestrationWeightedMetrics.percent;

  const showWorkspaceHubBadges = shouldShowWorkspaceHubNotificationBadges({
    readinessPercent,
    statusCounts: orchestrationStatusCounts,
  });

  const planningArtifactHub = buildArtifactHubBundle({
    mode: "planning",
    state: input.state,
    projectId: input.projectId,
    deliverableAssets,
    projectArtifacts,
  });

  const projectionState = input.orchestrationProjectionState ?? input.state;
  const orchestrationUi = buildOrchestrationUiProjection({
    state: projectionState,
    catalogCount: planningArtifactHub.catalog.length,
  });

  const deliverableViewerAssetIds = collectDeliverableViewerAssetIds({
    deliverableAssets,
    projectArtifacts,
    projectId: input.projectId.trim(),
  });

  return {
    slotDefs,
    slotDefsHash,
    orchestrationAlignedState,
    orchestrationUiState,
    orchestrationConfirmedMetrics,
    orchestrationWeightedMetrics,
    orchestrationStatusCounts,
    orchestrationSlotSections: [...orchestrationSlotSections, ...planningDataSlotSections],
    planningDataSlotSections,
    showWorkspaceHubBadges,
    planningArtifactHub,
    orchestrationUi,
    deliverableViewerAssetIds,
    deliverableAssets,
    projectArtifacts,
  };
}
