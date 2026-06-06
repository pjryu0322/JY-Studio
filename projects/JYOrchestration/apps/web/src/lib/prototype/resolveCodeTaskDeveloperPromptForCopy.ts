import { buildCodeTaskDeveloperPromptDetailed, buildStageTwoCodeTaskDeveloperPrompt } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { shouldReuseStoredDeveloperPrompt } from "@/lib/prototype/codeTaskDeveloperPromptCache";
import {
  formatDeveloperPromptHashSha256,
  logTaskCursorPromptCopyHashMismatch,
} from "@/lib/prototype/codeTaskDeveloperPromptDelivery";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import {
  findLatestRunForCodeTask,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildRuntimePromptQualityGateDiagnostics,
  CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE,
  logRuntimePromptQualityGateFailure,
  validateCodeTaskDeveloperPromptSafety,
} from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import {
  BRANCH_PLAN_REGRESSION_MESSAGE,
  assertStageTwoDeveloperPromptAllowed,
} from "@/lib/prototype/codeTaskDeveloperPromptQualityGate";
import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import {
  getCodeTaskPromptContextFromMap,
  type CodeTaskPromptContextMapV1,
} from "@/lib/prototype/codeTaskPromptContext";
import { resolveEffectiveAllowedPathGlobs } from "@/lib/prototype/codeTaskPromptPathPolicy";
import { resolveCodeTaskSpecificRole } from "@/lib/prototype/codeTaskPromptRoleResolver";
import { buildCodeTaskWorkBranch, resolveCodeTaskWorkBranchForTask, resolveCodeTaskBaseBranchForTask } from "@/lib/prototype/taskCursorExecution";
import { isCodeTaskReadyForDeveloperPrompt } from "@/lib/prototype/stageOnePromptReadiness";
import { fingerprintRuntimeDeveloperPrompt } from "@/lib/prototype/resolveRuntimeCodeTaskDeveloperPromptForExecute";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskPromptContextV1 } from "@/lib/prototype/codeTaskPromptContext";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

const TARGET_REPO_KIND = "generated_project" as const;

function logCopyExecutePromptHashMismatchIfNeeded(input: {
  readonly projectId: string;
  readonly processTaskId: string;
  readonly codeTaskId: string;
  readonly runId?: string | null;
  readonly copyPrompt: string;
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
}): void {
  const canonical = buildCodeTaskDeveloperPromptDetailed({
    codeTask: input.codeTask,
    parentTask: input.parentTask,
    promptContext: input.promptContext,
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch,
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoKind: TARGET_REPO_KIND,
  }).prompt.trim();
  const copyHash = fingerprintRuntimeDeveloperPrompt(input.copyPrompt);
  const executeHash = fingerprintRuntimeDeveloperPrompt(canonical);
  if (copyHash === executeHash) return;
  logTaskCursorPromptCopyHashMismatch({
    projectId: input.projectId,
    processTaskId: input.processTaskId,
    codeTaskId: input.codeTaskId,
    runId: input.runId,
    copyHash: formatDeveloperPromptHashSha256(input.copyPrompt),
    executeHash: formatDeveloperPromptHashSha256(canonical),
  });
}

export const CODE_TASK_STAGE_ONE_NOT_READY_MESSAGE =
  "CodeTask 1단계 프롬프트가 아직 실행 준비 상태가 아닙니다." as const;

export const CODE_TASK_STAGE_TWO_COPY_SUCCESS_MESSAGE =
  "현재 CodeTask 개발 프롬프트를 복사했습니다." as const;

export { formatDeveloperPromptSingleCopySuccessToast } from "@/lib/prototype/codeTaskDeveloperPromptBundle";

export const CODE_TASK_STAGE_ONE_PLAN_COPY_SUCCESS_MESSAGE =
  "CodeTask 1단계 계획 프롬프트를 복사했습니다. 이 프롬프트는 Cursor 실행용이 아닙니다." as const;

export function resolveGeneratedStageTwoDeveloperPromptForCopy(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly targetRepository: ProjectTargetRepository | null;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly codeTaskPromptContextMapV1?: CodeTaskPromptContextMapV1 | null;
  readonly nowIso?: string;
}): Readonly<{ readonly ok: boolean; readonly generated?: import("@/lib/prototype/generatedCodeTaskPrompt").GeneratedCodeTaskPromptV1; readonly reason?: string }> {
  const base = resolveCodeTaskDeveloperPromptForCopy(input);
  if (!base.ok || !base.prompt) {
    return { ok: false, reason: base.reason };
  }
  const stageCheck = assertStageTwoDeveloperPromptAllowed({ prompt: base.prompt });
  if (!stageCheck.ok) {
    return { ok: false, reason: stageCheck.message };
  }
  const codeTaskId = input.codeTaskId.trim();
  const target = resolveCodeTaskDispatchTarget({
    codeTaskId,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });
  if (!target || !input.targetRepository) {
    return { ok: false, reason: "프롬프트 생성 정보가 아직 없습니다." };
  }
  const promptContext = getCodeTaskPromptContextFromMap(
    input.codeTaskPromptContextMapV1,
    codeTaskId,
  );
  const branchPlan = parseCodeTaskBranchPlanV1(target.codeTask.branchPlan);
  const fileBoundary = parseCodeTaskFileBoundaryV1(target.codeTask.fileBoundary);
  if (!promptContext || !branchPlan || !fileBoundary) {
    return { ok: false, reason: CODE_TASK_STAGE_ONE_NOT_READY_MESSAGE };
  }
  const generated = buildStageTwoCodeTaskDeveloperPrompt({
    projectId: input.projectId,
    targetRepository: input.targetRepository,
    codeTask: target.codeTask,
    promptContext,
    branchPlan,
    fileBoundary,
    parentTask: target.parentTask,
    allowedPathGlobs: input.allowedPathGlobs,
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
  if (!generated.quality.ready) {
    if (generated.quality.missing.some((m) => m.includes("branch_plan_base"))) {
      return { ok: false, reason: BRANCH_PLAN_REGRESSION_MESSAGE };
    }
    return { ok: false, reason: CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE };
  }
  return { ok: true, generated };
}

export function resolveCodeTaskDeveloperPromptForCopy(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly targetRepository: ProjectTargetRepository | null;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly codeTaskPromptContextMapV1?: CodeTaskPromptContextMapV1 | null;
}): Readonly<{ readonly ok: boolean; readonly prompt?: string; readonly reason?: string }> {
  const codeTaskId = input.codeTaskId.trim();
  if (!codeTaskId) {
    return { ok: false, reason: "CodeTask ID가 없습니다." };
  }
  if (!input.targetRepository) {
    return { ok: false, reason: "GitHub 저장소 설정이 없어 프롬프트를 생성할 수 없습니다." };
  }

  const target = resolveCodeTaskDispatchTarget({
    codeTaskId,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });
  if (!target) {
    return { ok: false, reason: "프롬프트 생성 정보가 아직 없습니다." };
  }

  const allowedPathGlobs = resolveEffectiveAllowedPathGlobs({
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoFullName: input.targetRepository.repoFullName,
    targetRepoKind: TARGET_REPO_KIND,
  });

  const promptContext = getCodeTaskPromptContextFromMap(
    input.codeTaskPromptContextMapV1,
    codeTaskId,
  );
  if (!isCodeTaskReadyForDeveloperPrompt({ codeTask: target.codeTask, promptContext })) {
    return { ok: false, reason: CODE_TASK_STAGE_ONE_NOT_READY_MESSAGE };
  }
  const roleKind = resolveCodeTaskSpecificRole({
    codeTaskTitle: target.codeTask.title,
    codeTaskDescription: target.codeTask.description,
    parentTaskTitle: target.parentTask?.title,
    parentTaskDescription: target.parentTask?.description,
    requirements: target.codeTask.acceptanceCriteria,
    changeType: target.codeTask.changeType,
  }).roleKind;
  const workBranch = resolveCodeTaskWorkBranchForTask({ codeTask: target.codeTask });

  const run = findLatestRunForCodeTask(input.runs, codeTaskId);
  if (
    run &&
    shouldReuseStoredDeveloperPrompt({
      run,
      promptContext,
      targetRepoFullName: input.targetRepository.repoFullName,
      baseBranch: input.baseBranch,
      allowedPathGlobs: input.allowedPathGlobs,
    })
  ) {
    const stored = run.developerPrompt!.trim();
    const stageBlock = assertStageTwoDeveloperPromptAllowed({ prompt: stored });
    if (!stageBlock.ok) {
      return { ok: false, reason: stageBlock.message };
    }
    const storedSafety = validateCodeTaskDeveloperPromptSafety({
      prompt: stored,
      targetRepoFullName: input.targetRepository.repoFullName,
      targetRepoKind: TARGET_REPO_KIND,
      allowedPathGlobs,
      codeTaskId,
      workBranch,
      roleKind,
    });
    if (!storedSafety.ok) {
      logRuntimePromptQualityGateFailure(
        buildRuntimePromptQualityGateDiagnostics({
          codeTaskId,
          workBranch,
          errors: storedSafety.errors,
          warnings: storedSafety.warnings,
        }),
      );
    } else {
      if (storedSafety.warnings.length) {
        logRuntimePromptQualityGateFailure(
          buildRuntimePromptQualityGateDiagnostics({
            codeTaskId,
            workBranch,
            errors: [],
            warnings: storedSafety.warnings,
          }),
        );
      }
      logCopyExecutePromptHashMismatchIfNeeded({
        projectId: input.projectId,
        processTaskId: target.codeTask.parentTaskId,
        codeTaskId,
        runId: run.runId,
        copyPrompt: stored,
        codeTask: target.codeTask,
        parentTask: target.parentTask,
        promptContext,
        targetRepository: input.targetRepository,
        baseBranch: input.baseBranch,
        allowedPathGlobs: input.allowedPathGlobs,
      });
      return { ok: true, prompt: stored };
    }
  }

  const branchPlan = parseCodeTaskBranchPlanV1(target.codeTask.branchPlan);
  const fileBoundary = parseCodeTaskFileBoundaryV1(target.codeTask.fileBoundary);
  if (!promptContext || !branchPlan || !fileBoundary) {
    return { ok: false, reason: CODE_TASK_STAGE_ONE_NOT_READY_MESSAGE };
  }

  const generated = buildStageTwoCodeTaskDeveloperPrompt({
    projectId: input.projectId,
    targetRepository: input.targetRepository,
    codeTask: target.codeTask,
    promptContext,
    branchPlan,
    fileBoundary,
    parentTask: target.parentTask,
    allowedPathGlobs: input.allowedPathGlobs,
    nowIso: new Date().toISOString(),
  });
  if (!generated.quality.ready) {
    if (generated.quality.missing.some((m) => m.includes("branch_plan_base"))) {
      return { ok: false, reason: BRANCH_PLAN_REGRESSION_MESSAGE };
    }
    logRuntimePromptQualityGateFailure(
      buildRuntimePromptQualityGateDiagnostics({
        codeTaskId,
        workBranch,
        errors: [...generated.quality.missing],
        warnings: [...generated.quality.warnings],
      }),
    );
    return { ok: false, reason: CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE };
  }
  const built = generated.content.trim();

  if (!built) {
    return { ok: false, reason: "프롬프트 생성 정보가 아직 없습니다." };
  }

  const stageBlock = assertStageTwoDeveloperPromptAllowed({ prompt: built, stage: generated.stage });
  if (!stageBlock.ok) {
    return { ok: false, reason: stageBlock.message };
  }

  const safety = validateCodeTaskDeveloperPromptSafety({
    prompt: built,
    targetRepoFullName: input.targetRepository.repoFullName,
    targetRepoKind: TARGET_REPO_KIND,
    allowedPathGlobs,
    codeTaskId,
    workBranch,
    roleKind,
  });
  if (!safety.ok) {
    logRuntimePromptQualityGateFailure(
      buildRuntimePromptQualityGateDiagnostics({
        codeTaskId,
        workBranch,
        errors: safety.errors,
        warnings: safety.warnings,
      }),
    );
    return { ok: false, reason: CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE };
  }
  if (safety.warnings.length) {
    logRuntimePromptQualityGateFailure(
      buildRuntimePromptQualityGateDiagnostics({
        codeTaskId,
        workBranch,
        errors: [],
        warnings: safety.warnings,
      }),
    );
  }

  return { ok: true, prompt: built };
}
