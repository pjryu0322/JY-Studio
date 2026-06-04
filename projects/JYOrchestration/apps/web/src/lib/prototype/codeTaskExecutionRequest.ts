import { buildCodeTaskDeveloperPrompt } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import {
  buildCodeTaskWorkBranch,
  buildInitialTaskCursorExecution,
  patchTaskCursorExecution,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import type { ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import { updateCodeTaskExecutionRun } from "@/lib/prototype/codeTaskExecutionRun";

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
  readonly taskCursorRequest: TaskCursorExecutionV1;
  readonly requestBody: CodeTaskCursorExecuteRequestBody;
}>;

/** CodeTaskExecutionRun 기준 Cursor 실행 요청을 구성한다. TaskCursorExecution은 adapter 출력이다. */
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
  const now = input.nowIso ?? new Date().toISOString();
  const developerPrompt =
    input.run.developerPrompt?.trim() ||
    buildCodeTaskDeveloperPrompt({
      codeTask: input.codeTask,
      parentTask: input.parentTask,
      targetRepository: input.targetRepository,
      baseBranch: input.baseBranch,
      allowedPathGlobs: input.allowedPathGlobs,
    });
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
    run,
    developerPrompt,
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
  };
}
