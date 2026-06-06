import {
  buildImplementationExecutionBoardFromRequirementsState,
  type ImplementationExecutionBoardV1,
  type ImplementationRequirementsBoardOrchestrationSlice,
} from "@/lib/prototype/implementationExecutionBoard";
import { integrateCompletedCodeTasksForPreview } from "@/lib/prototype/implementationIntegrationService";
import { buildPreviewFromCompletedCodeTasks } from "@/lib/prototype/buildPreviewFromCompletedCodeTasks";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  deriveIntegratedExecutionStateReadiness,
  finalizeIntegratedStageStep,
  type ImplementationIntegratedExecutionStateV1,
  type ImplementationIntegratedStep,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import type { ImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import { buildIntegratedStageStepActionNotice } from "@/lib/prototype/implementationExecutionBoard";

const SYNC_INTEGRATED_STEPS: readonly ImplementationIntegratedStep[] = [
  "refactor_common",
  "integrated_review",
  "integrated_security",
];

function integratedRowStatus(
  board: ImplementationExecutionBoardV1,
  step: ImplementationIntegratedStep,
): string {
  return board.integratedRows.find((row) => row.step === step)?.status ?? "not_started";
}

function isRunnableIntegratedStatus(status: string): boolean {
  return status === "ready" || status === "queued" || status === "in_progress";
}

export { shouldShowIntegrationPipelineButton } from "@/lib/prototype/implementationIntegrationButtonPolicy";

export function isFinalScmIntegratedStepReady(board: ImplementationExecutionBoardV1): boolean {
  if (integratedRowStatus(board, "integrated_security") !== "done") return false;
  return isRunnableIntegratedStatus(integratedRowStatus(board, "final_scm"));
}

export type ApplyIntegratedPipelineSyncStepsResult =
  | Readonly<{
      readonly ok: true;
      readonly integratedState: ImplementationIntegratedExecutionStateV1;
      readonly previewScope: ImplementationPreviewScopeV1 | null;
      readonly previewRuntime: ImplementationPreviewRuntimeV1 | null;
      readonly previewBuildOk: boolean;
      readonly previewBuildError: string | null;
      readonly previewUrl: string | null;
      readonly completedSteps: readonly ImplementationIntegratedStep[];
      readonly noticeLines: readonly string[];
    }>
  | Readonly<{ readonly ok: false; readonly message: string }>;

export function applyIntegratedPipelineSyncSteps(input: {
  readonly projectId: string;
  readonly orchestration: ImplementationRequirementsBoardOrchestrationSlice;
  readonly nowIso?: string;
  readonly externalPreviewUrl?: string | null;
  readonly targetRepository?: string | null;
  readonly sourceIntegrationBranch?: string | null;
}): ApplyIntegratedPipelineSyncStepsResult {
  const pid = input.projectId.trim();
  if (!pid) return { ok: false, message: "프로젝트를 선택해 주세요." };

  const taskList = input.orchestration.implementationTaskListV1 ?? null;
  if (!taskList) {
    return { ok: false, message: "구현 작업목록이 없어 통합 단계를 실행할 수 없습니다." };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const integrationFirst = integrateCompletedCodeTasksForPreview({
    codeTaskPlan: input.orchestration.implementationCodeTaskPlanV1 ?? null,
    taskList,
    codeTaskRuns: input.orchestration.codeTaskExecutionRunsV1 ?? null,
    taskCursorExecution: input.orchestration.taskCursorExecutionV1 ?? null,
    taskCursorExecutionHistory: input.orchestration.taskCursorExecutionHistoryV1 ?? null,
    autoQualityGate: input.orchestration.implementationAutoQualityGateV1 ?? null,
    generatedAt: nowIso,
  });
  if (!integrationFirst.ok) {
    return { ok: false, message: integrationFirst.message };
  }

  let previewScope: ImplementationPreviewScopeV1 = integrationFirst.previewScope;
  let integratedState = input.orchestration.implementationIntegratedExecutionStateV1 ?? null;
  const completedSteps: ImplementationIntegratedStep[] = [];
  const noticeLines: string[] = [integrationFirst.summary];

  for (const step of SYNC_INTEGRATED_STEPS) {
    const stateReady = deriveIntegratedExecutionStateReadiness({
      projectId: pid,
      state: integratedState,
      integrationPipelineUnlocked: true,
      nowIso,
    });
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: pid,
      orchestration: {
        ...input.orchestration,
        implementationIntegratedExecutionStateV1: stateReady,
      },
      integratedExecutionState: stateReady,
      nowIso,
    });
    if (!board) {
      return { ok: false, message: "구현 실행 보드를 만들 수 없습니다." };
    }

    const status = integratedRowStatus(board, step);
    if (status === "done" || status === "skipped") continue;
    if (!isRunnableIntegratedStatus(status)) {
      continue;
    }

    if (step === "refactor_common") {
      previewScope = integrationFirst.previewScope;
    }

    integratedState = finalizeIntegratedStageStep({
      state: stateReady,
      projectId: pid,
      step,
      taskRowsCompleted: true,
      nowIso,
    });
    completedSteps.push(step);
    noticeLines.push(
      buildIntegratedStageStepActionNotice({ step, integratedState: integratedState }),
    );
  }

  const finalState = deriveIntegratedExecutionStateReadiness({
    projectId: pid,
    state: integratedState,
    integrationPipelineUnlocked: true,
    nowIso,
  });

  const resolvedScope = previewScope;

  let previewRuntime: ImplementationPreviewRuntimeV1 | null = null;
  let previewBuildOk = false;
  let previewBuildError: string | null = null;
  let previewUrl: string | null = null;

  if (resolvedScope?.includedCodeTasks.length) {
    const previewBuild = buildPreviewFromCompletedCodeTasks({
      projectId: pid,
      previewScope: resolvedScope,
      nowIso,
      externalPreviewUrl: input.externalPreviewUrl,
      targetRepository:
        input.targetRepository ??
        (String(input.orchestration.taskCursorExecutionV1?.targetRepository ?? "").trim() || null),
      sourceIntegrationBranch: input.sourceIntegrationBranch ?? null,
    });
    previewRuntime = previewBuild.runtime;
    previewBuildOk = previewBuild.ok;
    previewBuildError = previewBuild.errorMessage ?? null;
    previewUrl = previewBuild.previewUrl ?? null;

    if (
      resolvedScope.includedCodeTasks.length > 0 &&
      (!previewBuildOk || !previewRuntime || previewRuntime.status !== "ready" || !previewUrl)
    ) {
      const retry = buildPreviewFromCompletedCodeTasks({
        projectId: pid,
        previewScope: resolvedScope,
        nowIso,
        externalPreviewUrl: null,
        targetRepository:
          input.targetRepository ??
          (String(input.orchestration.taskCursorExecutionV1?.targetRepository ?? "").trim() || null),
        sourceIntegrationBranch: input.sourceIntegrationBranch ?? null,
      });
      if (retry.ok && retry.runtime.status === "ready" && retry.previewUrl) {
        previewRuntime = retry.runtime;
        previewBuildOk = true;
        previewBuildError = null;
        previewUrl = retry.previewUrl;
      } else if (!previewBuildOk) {
        previewBuildError =
          previewBuildError ?? retry.errorMessage ?? "Preview URL을 생성하지 못했습니다.";
      }
    }

    if (previewBuildOk) {
      noticeLines.push("Preview 준비 완료");
    } else if (previewBuildError) {
      noticeLines.push(`Preview 준비 실패: ${previewBuildError}`);
    }
  }

  return {
    ok: true,
    integratedState: finalState,
    previewScope: resolvedScope,
    previewRuntime,
    previewBuildOk,
    previewBuildError,
    previewUrl,
    completedSteps,
    noticeLines,
  };
}
