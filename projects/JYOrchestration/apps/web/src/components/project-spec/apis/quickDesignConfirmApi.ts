import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import type { ApiResponse } from "@/components/project-spec/types";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { QuickDesignConfirmServerMode } from "@/lib/prototype/quickDesignConfirmServer";

export type PostQuickDesignConfirmBody = Readonly<{
  readonly mode?: QuickDesignConfirmServerMode;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly requirementsStateJson?: unknown;
  readonly conversationMessages: readonly RequirementsMessage[];
  readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly sourceStage?: OrchestrationStage;
  readonly envOkOverride?: boolean;
  readonly serviceFlow?: unknown;
  readonly problemInterview?: unknown;
}>;

export type PostQuickDesignConfirmSuccess = Readonly<{
  readonly mode: QuickDesignConfirmServerMode;
  readonly messages?: readonly RequirementsMessage[];
  readonly orchestrationPatch?: Record<string, unknown>;
  readonly userFacingSummary?: string;
  readonly statePatch?: Record<string, unknown>;
  readonly timelineEntries?: readonly unknown[];
  readonly primaryArtifactId?: string;
}>;

export async function postQuickDesignConfirm(
  projectId: string,
  body: PostQuickDesignConfirmBody,
): Promise<{ readonly res: Response; readonly json: ApiResponse<PostQuickDesignConfirmSuccess> }> {
  const encoded = encodeURIComponent(projectId.trim());
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/quick-design/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<PostQuickDesignConfirmSuccess>;
  return { res, json };
}

export type PostImplementationPrepSyncBody = Readonly<{
  readonly seed: import("@/lib/requirements/implementationSeed").ImplementationSeedV1 | null;
  readonly existingTaskList?: import("@/lib/requirements/implementationTaskList").ImplementationTaskListV1 | null;
  readonly existingCodeTaskPlan?: import("@/lib/prototype/implementationCodeTaskPlan").ImplementationCodeTaskPlanV1 | null;
  readonly existingExecutionState?: import("@/lib/prototype/implementationTaskExecutionState").ImplementationTaskExecutionStateV1 | null;
  readonly existingCursorWorkItems?: readonly import("@/lib/prototype/implementationCursorWorkItems").CursorWorkItem[] | null;
  readonly existingPreflightSummary?: import("@/lib/prototype/implementationPlanningReadiness").ImplementationWorkItemPreflightSummaryV1 | null;
  readonly existingQualityGate?: import("@/lib/prototype/implementationCodeTaskQualityGate").ImplementationCodeTaskQualityGateV1 | null;
  readonly priorTimeline?: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[];
  readonly projectArtifacts?: readonly import("@/lib/requirements/projectArtifactTypes").ProjectArtifact[];
  readonly artifactOrchestrationV1?: import("@/lib/requirements/artifactOrchestration").ArtifactOrchestrationStateV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly previewReady?: boolean;
  readonly forceRefresh?: boolean;
  readonly forceLlm?: boolean;
}>;

export async function postImplementationPrepSync(
  projectId: string,
  body: PostImplementationPrepSyncBody,
): Promise<{
  readonly res: Response;
  readonly json: ApiResponse<import("@/lib/prototype/implementationTaskListGeneration").GenerateImplementationTaskListResult>;
}> {
  const encoded = encodeURIComponent(projectId.trim());
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/implementation-prep/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<
    import("@/lib/prototype/implementationTaskListGeneration").GenerateImplementationTaskListResult
  >;
  return { res, json };
}
