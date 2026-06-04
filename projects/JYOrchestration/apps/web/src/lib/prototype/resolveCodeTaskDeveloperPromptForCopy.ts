import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { shouldReuseStoredDeveloperPrompt } from "@/lib/prototype/codeTaskDeveloperPromptCache";
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
  getCodeTaskPromptContextFromMap,
  type CodeTaskPromptContextMapV1,
} from "@/lib/prototype/codeTaskPromptContext";
import { resolveEffectiveAllowedPathGlobs } from "@/lib/prototype/codeTaskPromptPathPolicy";
import { resolveCodeTaskSpecificRole } from "@/lib/prototype/codeTaskPromptRoleResolver";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const TARGET_REPO_KIND = "generated_project" as const;

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
  const roleKind = resolveCodeTaskSpecificRole({
    codeTaskTitle: target.codeTask.title,
    codeTaskDescription: target.codeTask.description,
    parentTaskTitle: target.parentTask?.title,
    parentTaskDescription: target.parentTask?.description,
    requirements: target.codeTask.acceptanceCriteria,
    changeType: target.codeTask.changeType,
  }).roleKind;
  const workBranch = buildCodeTaskWorkBranch(codeTaskId);

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
      return { ok: false, reason: CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE };
    }
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
    return { ok: true, prompt: stored };
  }

  const built = buildCodeTaskDeveloperPromptDetailed({
    codeTask: target.codeTask,
    parentTask: target.parentTask,
    promptContext,
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch,
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoKind: TARGET_REPO_KIND,
  }).prompt.trim();

  if (!built) {
    return { ok: false, reason: "프롬프트 생성 정보가 아직 없습니다." };
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
