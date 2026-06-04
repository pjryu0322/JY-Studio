import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import {
  CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE,
  CODE_TASK_PROMPT_SAFETY_BLOCK_MESSAGE,
  validateCodeTaskDeveloperPromptSafety,
} from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import { resolveEffectiveAllowedPathGlobs } from "@/lib/prototype/codeTaskPromptPathPolicy";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { updateCodeTaskExecutionRun } from "@/lib/prototype/codeTaskExecutionRun";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import {
  buildCodeTaskWorkBranch,
  buildInitialTaskCursorExecution,
  patchTaskCursorExecution,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import type { ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

export type CodeTaskCursorExecuteRequestBody = Readonly<{
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly taskId: string;
  readonly selectedWorkItemIds: readonly string[];
  readonly workItems: readonly CursorWorkItem[];
  readonly verifyGithub: true;
  readonly launchOnly: true;
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
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
}): BuildCodeTaskDeveloperPromptResultLike {
  const stored = input.run.developerPrompt?.trim();
  const allowedPathGlobs = resolveEffectiveAllowedPathGlobs({
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoFullName: input.targetRepository.repoFullName,
    targetRepoKind: "generated_project",
  });

  if (stored) {
    const safety = validateCodeTaskDeveloperPromptSafety({
      prompt: stored,
      targetRepoFullName: input.targetRepository.repoFullName,
      targetRepoKind: "generated_project",
      allowedPathGlobs,
    });
    if (safety.ok) {
      return { prompt: stored, removedCandidatePaths: [], warnings: [] };
    }
  }

  return buildCodeTaskDeveloperPromptDetailed({
    codeTask: input.codeTask,
    parentTask: input.parentTask,
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch,
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoKind: "generated_project",
  });
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
  readonly workItem: CursorWorkItem;
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly existingTaskCursor?: TaskCursorExecutionV1 | null;
  readonly nowIso?: string;
}): BuildCodeTaskCursorExecutionRequestResult {
  const now = input.nowIso ?? new Date().toISOString();
  const promptResult = resolveDeveloperPromptForCodeTask({
    run: input.run,
    codeTask: input.codeTask,
    parentTask: input.parentTask,
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch,
    allowedPathGlobs: input.allowedPathGlobs,
  });

  const allowedPathGlobs = resolveEffectiveAllowedPathGlobs({
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoFullName: input.targetRepository.repoFullName,
    targetRepoKind: "generated_project",
  });

  const safety = validateCodeTaskDeveloperPromptSafety({
    prompt: promptResult.prompt,
    targetRepoFullName: input.targetRepository.repoFullName,
    targetRepoKind: "generated_project",
    allowedPathGlobs,
  });

  if (!safety.ok) {
    return {
      ok: false,
      message: CODE_TASK_PROMPT_SAFETY_BLOCK_MESSAGE,
      errors: safety.errors,
    };
  }

  const developerPrompt = promptResult.prompt;
  const workBranch = buildCodeTaskWorkBranch(input.codeTask.codeTaskId);
  const parentTaskId = input.codeTask.parentTaskId;
  const taskCursorBase =
    input.existingTaskCursor?.taskId === parentTaskId
      ? input.existingTaskCursor
      : buildInitialTaskCursorExecution({
          projectId: input.projectId,
          taskId: parentTaskId,
          workItemIds: [input.workItem.id],
          targetRepository: input.targetRepository.repoFullName,
          baseBranch: input.baseBranch,
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
    workBranch,
    repository: input.targetRepository.repoFullName,
    baseBranch: input.baseBranch,
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
