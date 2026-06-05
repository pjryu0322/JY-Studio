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

const INTEGRATED_STEP_LABEL_KO: Readonly<Record<ImplementationIntegratedStep, string>> = {
  refactor_common: "리팩토링/공통화",
  integrated_review: "통합 검수",
  integrated_security: "통합 보안 점검",
  final_scm: "최종 SCM 반영",
};

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

export function shouldShowIntegrationPipelineButton(input: {
  readonly canIntegrate: boolean;
  readonly board: ImplementationExecutionBoardV1;
}): boolean {
  if (!input.canIntegrate) return false;
  if (
    input.board.integratedRows.every((row) => row.status === "done" || row.status === "skipped")
  ) {
    return false;
  }
  return input.board.integratedRows.some((row) => isRunnableIntegratedStatus(row.status));
}

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

function resolvePreviewScopeForPipeline(input: {
  readonly projectId: string;
  readonly orchestration: ImplementationRequirementsBoardOrchestrationSlice;
  readonly taskList: NonNullable<ImplementationRequirementsBoardOrchestrationSlice["implementationTaskListV1"]>;
  readonly existingScope: ImplementationPreviewScopeV1 | null;
  readonly nowIso: string;
}): ImplementationPreviewScopeV1 | null {
  if (input.existingScope) return input.existingScope;
  const fromState = input.orchestration.implementationPreviewScopeV1 ?? null;
  if (fromState) return fromState;
  const integration = integrateCompletedCodeTasksForPreview({
    codeTaskPlan: input.orchestration.implementationCodeTaskPlanV1 ?? null,
    taskList: input.taskList,
    codeTaskRuns: input.orchestration.codeTaskExecutionRunsV1 ?? null,
    taskCursorExecution: input.orchestration.taskCursorExecutionV1 ?? null,
    taskCursorExecutionHistory: input.orchestration.taskCursorExecutionHistoryV1 ?? null,
    autoQualityGate: input.orchestration.implementationAutoQualityGateV1 ?? null,
    generatedAt: input.nowIso,
  });
  return integration.ok ? integration.previewScope : null;
}

export function applyIntegratedPipelineSyncSteps(input: {
  readonly projectId: string;
  readonly orchestration: ImplementationRequirementsBoardOrchestrationSlice;
  readonly nowIso?: string;
  readonly externalPreviewUrl?: string | null;
  readonly targetRepository?: string | null;
}): ApplyIntegratedPipelineSyncStepsResult {
  const pid = input.projectId.trim();
  if (!pid) return { ok: false, message: "프로젝트를 선택해 주세요." };

  const taskList = input.orchestration.implementationTaskListV1 ?? null;
  if (!taskList) {
    return { ok: false, message: "구현 작업목록이 없어 통합 단계를 실행할 수 없습니다." };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  let previewScope: ImplementationPreviewScopeV1 | null = null;
  let integratedState = input.orchestration.implementationIntegratedExecutionStateV1 ?? null;
  const completedSteps: ImplementationIntegratedStep[] = [];
  const noticeLines: string[] = [];

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
      const label = INTEGRATED_STEP_LABEL_KO[step];
      return {
        ok: false,
        message: `${label} 단계가 아직 실행 가능한 상태가 아닙니다.`,
      };
    }

    if (step === "refactor_common") {
      const integration = integrateCompletedCodeTasksForPreview({
        codeTaskPlan: input.orchestration.implementationCodeTaskPlanV1 ?? null,
        taskList,
        codeTaskRuns: input.orchestration.codeTaskExecutionRunsV1 ?? null,
        taskCursorExecution: input.orchestration.taskCursorExecutionV1 ?? null,
        taskCursorExecutionHistory: input.orchestration.taskCursorExecutionHistoryV1 ?? null,
        autoQualityGate: input.orchestration.implementationAutoQualityGateV1 ?? null,
        generatedAt: nowIso,
      });
      if (!integration.ok) {
        return { ok: false, message: integration.message };
      }
      previewScope = integration.previewScope;
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

  const resolvedScope = resolvePreviewScopeForPipeline({
    projectId: pid,
    orchestration: input.orchestration,
    taskList,
    existingScope: previewScope,
    nowIso,
  });

  let previewRuntime: ImplementationPreviewRuntimeV1 | null = null;
  let previewBuildOk = false;
  let previewBuildError: string | null = null;
  let previewUrl: string | null = null;

  if (resolvedScope) {
    const previewBuild = buildPreviewFromCompletedCodeTasks({
      projectId: pid,
      previewScope: resolvedScope,
      nowIso,
      externalPreviewUrl: input.externalPreviewUrl,
      targetRepository:
        input.targetRepository ??
        (String(input.orchestration.taskCursorExecutionV1?.targetRepository ?? "").trim() || null),
    });
    previewRuntime = previewBuild.runtime;
    previewBuildOk = previewBuild.ok;
    previewBuildError = previewBuild.errorMessage ?? null;
    previewUrl = previewBuild.previewUrl ?? null;
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
