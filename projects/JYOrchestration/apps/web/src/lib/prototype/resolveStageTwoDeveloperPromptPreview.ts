import { buildStageOneCodeTaskPlanningSummaryPrompt } from "@/lib/prototype/buildCodeTaskStageOnePrompt";
import { buildStageTwoCodeTaskDeveloperPrompt } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { getCodeTaskPromptContextFromMap, type CodeTaskPromptContextMapV1 } from "@/lib/prototype/codeTaskPromptContext";
import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { resolveExecutionTargetCodeTaskId } from "@/lib/prototype/resolveExecutionTargetCodeTaskId";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export function resolveStageTwoDeveloperPromptPreview(input: {
  readonly projectId: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly taskList: ImplementationTaskListV1 | null | undefined;
  readonly codeTaskPromptContextMapV1?: CodeTaskPromptContextMapV1 | null;
  readonly targetRepository: ProjectTargetRepository | null;
  readonly selectedCodeTaskId?: string | null;
  readonly runtimeCurrentCodeTaskId?: string | null;
  readonly allowedPathGlobs?: readonly string[];
}): Readonly<{
  readonly codeTaskId: string | null;
  readonly title: string | null;
  readonly branchGroup: string | null;
  readonly baseBranch: string | null;
  readonly workBranch: string | null;
  readonly preview: string;
  readonly ready: boolean;
}> {
  const codeTaskId = resolveExecutionTargetCodeTaskId({
    selectedCodeTaskId: input.selectedCodeTaskId,
    runtimeCurrentCodeTaskId: input.runtimeCurrentCodeTaskId,
    codeTaskPlan: input.codeTaskPlan ?? null,
  });
  if (!codeTaskId || !input.targetRepository || !input.codeTaskPlan) {
    return {
      codeTaskId: null,
      title: null,
      branchGroup: null,
      baseBranch: null,
      workBranch: null,
      preview: "",
      ready: false,
    };
  }
  const codeTask = input.codeTaskPlan.tasks.find((t) => t.codeTaskId === codeTaskId) ?? null;
  if (!codeTask) {
    return {
      codeTaskId,
      title: null,
      branchGroup: null,
      baseBranch: null,
      workBranch: null,
      preview: "",
      ready: false,
    };
  }
  const promptContext = getCodeTaskPromptContextFromMap(input.codeTaskPromptContextMapV1, codeTaskId);
  const branchPlan = parseCodeTaskBranchPlanV1(codeTask.branchPlan);
  const fileBoundary = parseCodeTaskFileBoundaryV1(codeTask.fileBoundary);
  if (!promptContext || !branchPlan || !fileBoundary) {
    return {
      codeTaskId,
      title: codeTask.title,
      branchGroup: branchPlan?.branchGroup ?? null,
      baseBranch: branchPlan?.baseBranch ?? null,
      workBranch: branchPlan?.workBranch ?? null,
      preview: "",
      ready: false,
    };
  }
  const parentTask =
    input.taskList?.tasks.find((t) => t.taskId === codeTask.parentTaskId) ?? null;
  const generated = buildStageTwoCodeTaskDeveloperPrompt({
    projectId: input.projectId,
    targetRepository: input.targetRepository,
    codeTask,
    promptContext,
    branchPlan,
    fileBoundary,
    parentTask,
    allowedPathGlobs: input.allowedPathGlobs,
    nowIso: new Date().toISOString(),
  });
  return {
    codeTaskId,
    title: codeTask.title,
    branchGroup: branchPlan.branchGroup,
    baseBranch: branchPlan.baseBranch,
    workBranch: branchPlan.workBranch,
    preview: generated.content,
    ready: generated.quality.ready,
  };
}

export { buildStageOneCodeTaskPlanningSummaryPrompt };
