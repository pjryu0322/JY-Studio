import { buildStageTwoCodeTaskDeveloperPrompt } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import {
  buildDeveloperPromptMeta,
  shouldReuseStoredDeveloperPrompt,
} from "@/lib/prototype/codeTaskDeveloperPromptCache";
import type { CodeTaskPromptContextV1 } from "@/lib/prototype/codeTaskPromptContext";
import {
  buildRuntimePromptQualityGateDiagnostics,
  CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE,
  CODE_TASK_PROMPT_SAFETY_BLOCK_MESSAGE,
  logRuntimePromptQualityGateFailure,
  validateCodeTaskDeveloperPromptSafety,
} from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import { resolveEffectiveAllowedPathGlobs } from "@/lib/prototype/codeTaskPromptPathPolicy";
import { resolveCodeTaskSpecificRole } from "@/lib/prototype/codeTaskPromptRoleResolver";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { updateCodeTaskExecutionRun } from "@/lib/prototype/codeTaskExecutionRun";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type {
  ImplementationCodeTaskPlanV1,
  ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskConflictPlanV1 } from "@/lib/prototype/codeTaskFileConflictPlanner";
import {
  blockingIssuesForCodeTaskExecute,
  listIgnoredCrossForbiddenMirrorsForExecute,
  resolveCodeTaskConflictPlanForExecution,
} from "@/lib/prototype/codeTaskFileConflictPlanner";
import {
  evaluateCodeTaskFileBoundaryGateFromTask,
  formatCodeTaskFileBoundaryExecutionBlockMessage,
  formatCodeTaskFileConflictCrossTaskBlockMessage,
} from "@/lib/prototype/codeTaskFileBoundaryGate";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import {
  resolveCodeTaskWorkBranchForTask,
  resolveCodeTaskBaseBranchForTask,
  buildInitialTaskCursorExecution,
  patchTaskCursorExecution,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import {
  assertStageTwoDeveloperPromptAllowed,
  STAGE_TWO_CURSOR_BLOCK_MESSAGE,
} from "@/lib/prototype/codeTaskDeveloperPromptQualityGate";
import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import { repairLegacyMockProcessTaskId } from "@/lib/prototype/codeTaskRunTargetCanonical";
import { fingerprintRuntimeDeveloperPrompt } from "@/lib/prototype/resolveRuntimeCodeTaskDeveloperPromptForExecute";
import type { ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

export type CodeTaskCursorExecuteRequestBody = Readonly<{
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly taskId: string;
  readonly selectedWorkItemIds: readonly string[];
  readonly workItems: readonly CursorWorkItem[];
  readonly verifyGithub: true;
  readonly launchOnly: true;
  readonly developerPrompt: string;
  readonly developerPromptFingerprint: string;
  readonly promptSource: "runtime_code_task_developer_prompt";
  readonly workBranch: string;
}>;

export type BuiltCodeTaskCursorExecutionRequest = Readonly<{
  readonly run: CodeTaskExecutionRunV1;
  readonly developerPrompt: string;
  readonly developerPromptDiagnostics?: Readonly<{
    readonly removedCandidatePaths: readonly string[];
    readonly warnings: readonly string[];
  }>;
  readonly taskCursorRequest: TaskCursorExecutionV1;
  readonly requestBody: CodeTaskCursorExecuteRequestBody;
}>;

export type BuildCodeTaskCursorExecutionRequestResult =
  | Readonly<{ readonly ok: true; readonly built: BuiltCodeTaskCursorExecutionRequest }>
  | Readonly<{ readonly ok: false; readonly message: string; readonly errors: readonly string[] }>;

function resolveDeveloperPromptForCodeTask(input: {
  readonly run: CodeTaskExecutionRunV1;
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly nowIso: string;
}): BuildCodeTaskDeveloperPromptResultLike {
  const allowedPathGlobs = resolveEffectiveAllowedPathGlobs({
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoFullName: input.targetRepository.repoFullName,
    targetRepoKind: "generated_project",
  });

  if (
    shouldReuseStoredDeveloperPrompt({
      run: input.run,
      promptContext: input.promptContext,
      targetRepoFullName: input.targetRepository.repoFullName,
      baseBranch: input.baseBranch,
      allowedPathGlobs,
    })
  ) {
    const stored = input.run.developerPrompt!.trim();
    const stageBlock = assertStageTwoDeveloperPromptAllowed({ prompt: stored });
    if (!stageBlock.ok) {
      return { prompt: "", removedCandidatePaths: [], warnings: stageBlock.errors };
    }
    return { prompt: stored, removedCandidatePaths: [], warnings: [] };
  }

  const branchPlan = parseCodeTaskBranchPlanV1(input.codeTask.branchPlan);
  const fileBoundary = parseCodeTaskFileBoundaryV1(input.codeTask.fileBoundary);
  if (!input.promptContext || !branchPlan || !fileBoundary) {
    return { prompt: "", removedCandidatePaths: [], warnings: ["missing_stage_two_inputs"] };
  }

  const generated = buildStageTwoCodeTaskDeveloperPrompt({
    projectId: input.run.projectId,
    targetRepository: input.targetRepository,
    codeTask: input.codeTask,
    promptContext: input.promptContext,
    branchPlan,
    fileBoundary,
    parentTask: input.parentTask,
    allowedPathGlobs: input.allowedPathGlobs,
    nowIso: input.nowIso,
  });
  return {
    prompt: generated.content,
    removedCandidatePaths: [],
    warnings: [...generated.quality.warnings],
  };
}

type BuildCodeTaskDeveloperPromptResultLike = Readonly<{
  readonly prompt: string;
  readonly removedCandidatePaths: readonly string[];
  readonly warnings: readonly string[];
}>;

export function tryBuildCodeTaskCursorExecutionRequest(input: {
  readonly projectId: string;
  readonly run: CodeTaskExecutionRunV1;
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
  readonly workItem: CursorWorkItem;
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly existingTaskCursor?: TaskCursorExecutionV1 | null;
  readonly nowIso?: string;
  readonly codeTaskConflictPlan?: CodeTaskConflictPlanV1 | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
}): BuildCodeTaskCursorExecutionRequestResult {
  const now = input.nowIso ?? new Date().toISOString();

  const boundaryGate = evaluateCodeTaskFileBoundaryGateFromTask(input.codeTask);
  if (!boundaryGate.ok) {
    const message = formatCodeTaskFileBoundaryExecutionBlockMessage(boundaryGate);
    logRuntimePromptQualityGateFailure(
      buildRuntimePromptQualityGateDiagnostics({
        codeTaskId: input.codeTask.codeTaskId,
        workBranch: resolveCodeTaskWorkBranchForTask({ codeTask: input.codeTask }),
        errors: [boundaryGate.code],
        warnings: [],
      }),
    );
    return {
      ok: false,
      message,
      errors: [boundaryGate.code],
      warnings: [],
    };
  }

  const allTasks = input.codeTaskPlan?.tasks?.length
    ? input.codeTaskPlan.tasks
    : [input.codeTask];

  const resolvedConflict = resolveCodeTaskConflictPlanForExecution({
    codeTask: input.codeTask,
    codeTaskPlan: input.codeTaskPlan,
    storedConflictPlan: input.codeTaskConflictPlan,
  });
  if (resolvedConflict.repairMeta && typeof console !== "undefined" && console.info) {
    console.info("[code_task_conflict_plan_repaired_for_execution]", resolvedConflict.repairMeta);
  }

  const fileBoundaryBlocking = blockingIssuesForCodeTaskExecute({
    plan: resolvedConflict.conflictPlan,
    codeTask: input.codeTask,
    allTasks,
  });
  if (fileBoundaryBlocking.length) {
    const branchGroup = parseCodeTaskBranchPlanV1(input.codeTask.branchPlan)?.branchGroup ?? null;
    const message = formatCodeTaskFileConflictCrossTaskBlockMessage(
      fileBoundaryBlocking,
      branchGroup,
    );
    logRuntimePromptQualityGateFailure(
      buildRuntimePromptQualityGateDiagnostics({
        codeTaskId: input.codeTask.codeTaskId,
        workBranch: resolveCodeTaskWorkBranchForTask({ codeTask: input.codeTask }),
        errors: ["file_boundary_conflict"],
        warnings: [],
      }),
    );
    return {
      ok: false,
      message,
      errors: ["file_boundary_conflict"],
      warnings: [],
    };
  }

  const ignoredMirrors = listIgnoredCrossForbiddenMirrorsForExecute({
    plan: input.codeTaskConflictPlan ?? resolvedConflict.conflictPlan,
    codeTask: input.codeTask,
    allTasks,
  });
  if (ignoredMirrors.length && typeof console !== "undefined" && console.info) {
    for (const diag of ignoredMirrors) {
      console.info("[code_task_cross_forbidden_mirror_ignored]", diag);
    }
  }

  const promptResult = resolveDeveloperPromptForCodeTask({
    run: input.run,
    codeTask: input.codeTask,
    parentTask: input.parentTask,
    promptContext: input.promptContext,
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch,
    allowedPathGlobs: input.allowedPathGlobs,
    nowIso: now,
  });

  const stageBlock = assertStageTwoDeveloperPromptAllowed({ prompt: promptResult.prompt });
  if (!stageBlock.ok || !promptResult.prompt.trim()) {
    logRuntimePromptQualityGateFailure(
      buildRuntimePromptQualityGateDiagnostics({
        codeTaskId: input.codeTask.codeTaskId,
        workBranch: resolveCodeTaskWorkBranchForTask({ codeTask: input.codeTask }),
        errors: stageBlock.ok ? ["empty_stage_two_prompt"] : stageBlock.errors,
        warnings: [],
      }),
    );
    return {
      ok: false,
      message: stageBlock.ok ? CODE_TASK_PROMPT_SAFETY_BLOCK_MESSAGE : STAGE_TWO_CURSOR_BLOCK_MESSAGE,
      errors: stageBlock.ok ? ["empty_stage_two_prompt"] : stageBlock.errors,
      warnings: [],
    };
  }

  const allowedPathGlobs = resolveEffectiveAllowedPathGlobs({
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoFullName: input.targetRepository.repoFullName,
    targetRepoKind: "generated_project",
  });

  const roleKind = resolveCodeTaskSpecificRole({
    codeTaskTitle: input.codeTask.title,
    codeTaskDescription: input.codeTask.description,
    parentTaskTitle: input.parentTask?.title,
    parentTaskDescription: input.parentTask?.description,
    requirements: input.codeTask.acceptanceCriteria,
    changeType: input.codeTask.changeType,
  }).roleKind;
  const safety = validateCodeTaskDeveloperPromptSafety({
    prompt: promptResult.prompt,
    targetRepoFullName: input.targetRepository.repoFullName,
    targetRepoKind: "generated_project",
    allowedPathGlobs,
    codeTaskId: input.codeTask.codeTaskId,
    workBranch: resolveCodeTaskWorkBranchForTask({ codeTask: input.codeTask }),
    roleKind,
  });

  if (!safety.ok) {
    logRuntimePromptQualityGateFailure(
      buildRuntimePromptQualityGateDiagnostics({
        codeTaskId: input.codeTask.codeTaskId,
        workBranch: resolveCodeTaskWorkBranchForTask({ codeTask: input.codeTask }),
        errors: safety.errors,
        warnings: safety.warnings,
      }),
    );
    return {
      ok: false,
      message: CODE_TASK_PROMPT_SAFETY_BLOCK_MESSAGE,
      errors: safety.errors,
      warnings: safety.warnings,
    };
  }
  if (safety.warnings.length) {
    logRuntimePromptQualityGateFailure(
      buildRuntimePromptQualityGateDiagnostics({
        codeTaskId: input.codeTask.codeTaskId,
        workBranch: resolveCodeTaskWorkBranchForTask({ codeTask: input.codeTask }),
        errors: [],
        warnings: safety.warnings,
      }),
    );
  }

  const developerPrompt = promptResult.prompt;
  const developerPromptMeta = buildDeveloperPromptMeta({
    developerPrompt,
    promptContext: input.promptContext,
    targetRepoFullName: input.targetRepository.repoFullName,
    baseBranch: input.baseBranch,
    allowedPathGlobs,
    generatedAt: now,
  });
  const workBranch = resolveCodeTaskWorkBranchForTask({ codeTask: input.codeTask });
  const effectiveBaseBranch = resolveCodeTaskBaseBranchForTask({
    codeTask: input.codeTask,
    fallbackBaseBranch: input.baseBranch,
  });
  const branchPlanForParent = parseCodeTaskBranchPlanV1(input.codeTask.branchPlan);
  const parentTaskId = repairLegacyMockProcessTaskId({
    taskId: input.codeTask.parentTaskId,
    codeTaskId: input.codeTask.codeTaskId,
    branchGroup: branchPlanForParent?.branchGroup ?? null,
  });
  const existingCursor = input.existingTaskCursor;
  const canReuseExistingCursor =
    existingCursor?.taskId === parentTaskId &&
    String(existingCursor.workBranch ?? "").trim() === workBranch;
  const taskCursorBase = canReuseExistingCursor
    ? existingCursor
    : buildInitialTaskCursorExecution({
          projectId: input.projectId,
          taskId: parentTaskId,
          workItemIds: [input.workItem.id],
          targetRepository: input.targetRepository.repoFullName,
          baseBranch: effectiveBaseBranch,
          workBranch,
          nowIso: now,
        });
  const taskCursorRequest = patchTaskCursorExecution(taskCursorBase, {
    workItemIds: [input.workItem.id],
    workBranch,
    cursorPrompt: developerPrompt,
    status: "prompt_ready",
    nowIso: now,
  });
  const run = updateCodeTaskExecutionRun([input.run], input.run.runId, {
    developerPrompt,
    developerPromptMeta,
    workBranch,
    repository: input.targetRepository.repoFullName,
    baseBranch: effectiveBaseBranch,
    processTaskId: parentTaskId,
    status: "prompt_ready",
    updatedAt: now,
  })[0]!;

  return {
    ok: true,
    built: {
      run,
      developerPrompt,
      developerPromptDiagnostics: {
        removedCandidatePaths: promptResult.removedCandidatePaths,
        warnings: promptResult.warnings,
      },
      taskCursorRequest,
      requestBody: {
        projectId: input.projectId.trim(),
        codeTaskId: input.codeTask.codeTaskId,
        taskId: parentTaskId,
        selectedWorkItemIds: [input.workItem.id],
        workItems: [input.workItem],
        verifyGithub: true,
        launchOnly: true,
        developerPrompt,
        developerPromptFingerprint: fingerprintRuntimeDeveloperPrompt(developerPrompt),
        promptSource: "runtime_code_task_developer_prompt",
        workBranch,
      },
    },
  };
}

/** @deprecated Prefer tryBuildCodeTaskCursorExecutionRequest for safety gate handling */
export function buildCodeTaskCursorExecutionRequest(input: {
  readonly projectId: string;
  readonly run: CodeTaskExecutionRunV1;
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
  readonly workItem: CursorWorkItem;
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly existingTaskCursor?: TaskCursorExecutionV1 | null;
  readonly nowIso?: string;
}): BuiltCodeTaskCursorExecutionRequest {
  const result = tryBuildCodeTaskCursorExecutionRequest(input);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.built;
}

export { CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE, CODE_TASK_PROMPT_SAFETY_BLOCK_MESSAGE };
