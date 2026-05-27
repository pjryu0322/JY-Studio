/**
 * 구현(/execution) 화면 — 기획 SingleChat·Artifact Hub 오케스트레이션 읽기 전용 투영.
 */

import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { WorkspaceIdeationInterviewProgressUi } from "@/components/workspace/WorkspaceProgressPill";
import { buildWorkspacePlanningOrchestrationView } from "@/lib/requirements/buildWorkspacePlanningOrchestrationView";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { ProjectArtifactHubEntry } from "@/lib/requirements/projectArtifactHub";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { parseRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";

export type PrototypeExecutionPlanningOrchestrationView = Readonly<{
  readonly persistedState: RequirementsStateJson;
  readonly deliverableAssets: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly artifactHubCatalog: readonly ProjectArtifactHubEntry[];
  readonly artifactHubCompletedCount: number;
  readonly showArtifactHubBadge: boolean;
  readonly orchestrationUi: ReturnType<
    typeof buildWorkspacePlanningOrchestrationView
  >["orchestrationUi"];
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
  const view = buildWorkspacePlanningOrchestrationView({
    state: persistedState,
    projectId: input.projectId,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    servicePlanningAgentCatalogKeys: input.servicePlanningAgentCatalogKeys ?? null,
  });

  const planningProgressUi: WorkspaceIdeationInterviewProgressUi = {
    active: view.showWorkspaceHubBadges,
    readinessPercent: view.orchestrationWeightedMetrics.percent,
    covered: view.orchestrationConfirmedMetrics.confirmed,
    total: view.orchestrationConfirmedMetrics.total,
    statusCounts: view.orchestrationStatusCounts,
    remainingQuestionsEstimate: Math.max(
      0,
      view.orchestrationConfirmedMetrics.total - view.orchestrationConfirmedMetrics.confirmed,
    ),
    onForceGeneratePlanNow: () => {},
    orchestrationSlotSections: view.orchestrationSlotSections,
  };

  return {
    persistedState,
    deliverableAssets: view.deliverableAssets,
    projectArtifacts: view.projectArtifacts,
    artifactHubCatalog: view.planningArtifactHub.catalog,
    artifactHubCompletedCount: view.planningArtifactHub.completedCount,
    showArtifactHubBadge: view.showWorkspaceHubBadges,
    orchestrationUi: view.orchestrationUi,
    orchestrationUiState: view.orchestrationUiState,
    planningProgressUi,
    deliverableViewerAssetIds: view.deliverableViewerAssetIds,
  };
}
