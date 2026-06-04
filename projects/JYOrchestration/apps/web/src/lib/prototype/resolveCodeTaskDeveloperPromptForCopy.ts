import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import {
  findLatestRunForCodeTask,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import {
  CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE,
  validateCodeTaskDeveloperPromptSafety,
} from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import { resolveEffectiveAllowedPathGlobs } from "@/lib/prototype/codeTaskPromptPathPolicy";
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

  const run = findLatestRunForCodeTask(input.runs, codeTaskId);
  const stored = run?.developerPrompt?.trim();
  if (stored) {
    const storedSafety = validateCodeTaskDeveloperPromptSafety({
      prompt: stored,
      targetRepoFullName: input.targetRepository.repoFullName,
      targetRepoKind: TARGET_REPO_KIND,
      allowedPathGlobs,
    });
    if (storedSafety.ok) {
      return { ok: true, prompt: stored };
    }
  }

  const built = buildCodeTaskDeveloperPromptDetailed({
    codeTask: target.codeTask,
    parentTask: target.parentTask,
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
  });
  if (!safety.ok) {
    return { ok: false, reason: CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE };
  }

  return { ok: true, prompt: built };
}
