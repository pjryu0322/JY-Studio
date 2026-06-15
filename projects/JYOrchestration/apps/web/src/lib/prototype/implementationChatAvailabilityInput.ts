import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import type { CodeTaskIntegrationSource } from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import { resolveIntegrationPipelineUnlocked } from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import {
  resolveImplementationChatPreviewAccess,
  type ImplementationChatPreviewAccess,
} from "@/lib/prototype/implementationChatPreviewAccess";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ImplementationChatAvailabilityInput = Readonly<{
  readonly implementationStarted: boolean;
  readonly codeTasksCompleted: boolean;
  readonly githubVerified: boolean;
  readonly integrationCompleted: boolean;
  readonly previewUrl?: string | null;
  readonly previewReady: boolean;
  readonly previewOpenTargetReady?: boolean;
  readonly sampleDataRequired: boolean;
  readonly sampleDataQualityOk: boolean;
  readonly sampleDataRenderedOk: boolean;
  readonly sampleDataStatus?: import("@/lib/prototype/implementationPreviewSampleDataReadiness").ImplementationPreviewSampleDataReadinessStatus;
  readonly hasFailedTasks: boolean;
}>;

function integratedStepStatus(
  board: ImplementationExecutionBoardV1 | null,
  step: "refactor_common" | "integrated_review" | "integrated_security" | "final_scm",
): string | undefined {
  return board?.integratedRows.find((row) => row.step === step)?.status;
}

export function computeImplementationChatCanChat(input: ImplementationChatAvailabilityInput): boolean {
  const previewAccessible =
    Boolean(String(input.previewUrl ?? "").trim()) &&
    input.previewReady === true &&
    input.previewOpenTargetReady !== false;

  const sampleDataOk =
    !input.sampleDataRequired || (input.sampleDataQualityOk && input.sampleDataRenderedOk);

  return (
    input.implementationStarted &&
    input.codeTasksCompleted &&
    input.githubVerified &&
    input.integrationCompleted &&
    previewAccessible &&
    sampleDataOk &&
    !input.hasFailedTasks
  );
}

export function buildImplementationChatAvailabilityInput(input: Readonly<{
  readonly projectId: string;
  readonly implementationStarted: boolean;
  readonly board: ImplementationExecutionBoardV1 | null;
  readonly integrationSource: CodeTaskIntegrationSource;
  readonly requirementsState: RequirementsStateJson;
  readonly activeTaskCursorRunning: boolean;
  readonly taskCursorGithubVerifying: boolean;
  readonly controlPlanePreviewReady: boolean;
  readonly controlPlanePreviewUrl: string | null;
  readonly controlPlaneIntegrationReady: boolean;
}>): ImplementationChatAvailabilityInput & Readonly<{ readonly previewAccess: ImplementationChatPreviewAccess }> {
  const summary = input.board?.summary;
  const hasFailedTasks =
    (summary?.failedTasks ?? 0) > 0 || (summary?.reworkRequiredTasks ?? 0) > 0;
  const inProgressTasks = summary?.inProgressTasks ?? 0;
  const integrationPipelineUnlocked = resolveIntegrationPipelineUnlocked(input.integrationSource);

  const refactorDone = integratedStepStatus(input.board, "refactor_common") === "done";
  const integratedInProgress = (input.board?.integratedRows ?? []).some(
    (row) => row.status === "in_progress" || row.status === "queued",
  );

  const previewAccess = resolveImplementationChatPreviewAccess({
    projectId: input.projectId,
    integrationSource: input.integrationSource,
    requirementsState: input.requirementsState,
    controlPlanePreviewReady: input.controlPlanePreviewReady,
    controlPlanePreviewUrl: input.controlPlanePreviewUrl,
  });

  const pipelineCompleteFromControlPlane =
    input.controlPlanePreviewReady && input.controlPlaneIntegrationReady;

  const codeTasksCompleted = pipelineCompleteFromControlPlane
    ? true
    : !input.activeTaskCursorRunning && inProgressTasks === 0 && integrationPipelineUnlocked;

  const githubVerified = pipelineCompleteFromControlPlane
    ? true
    : integrationPipelineUnlocked && !input.taskCursorGithubVerifying;

  const integrationCompleted = pipelineCompleteFromControlPlane
    ? true
    : integrationPipelineUnlocked && refactorDone && !integratedInProgress;

  const availabilityInput: ImplementationChatAvailabilityInput = {
    implementationStarted: input.implementationStarted,
    codeTasksCompleted,
    githubVerified,
    integrationCompleted,
    previewUrl: previewAccess.previewUrl,
    previewReady: previewAccess.previewReady,
    previewOpenTargetReady: previewAccess.previewOpenTargetReady,
    sampleDataRequired: previewAccess.readiness.sampleDataRequired,
    sampleDataQualityOk: previewAccess.readiness.sampleDataQualityOk,
    sampleDataRenderedOk: previewAccess.readiness.sampleDataRenderedOk,
    sampleDataStatus: previewAccess.readiness.sampleDataStatus,
    hasFailedTasks,
  };

  return { ...availabilityInput, previewAccess };
}
