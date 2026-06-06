import { assertStageTwoDeveloperPromptAllowed } from "@/lib/prototype/codeTaskDeveloperPromptQualityGate";
import {
  buildGeneratedStageTwoDeveloperPrompt,
  type GeneratedCodeTaskPromptV1,
} from "@/lib/prototype/generatedCodeTaskPrompt";
import { resolveCodeTaskDeveloperPromptForCopy } from "@/lib/prototype/resolveCodeTaskDeveloperPromptForCopy";
import { sortCodeTasksByBranchPlanOrder } from "@/lib/prototype/prepareCodeTaskPlanForStageOnePrompt";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskPromptContextMapV1 } from "@/lib/prototype/codeTaskPromptContext";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export const DEVELOPER_PROMPT_BUNDLE_NOT_FOR_CURSOR =
  "이 묶음은 한 번에 Cursor에 전달하는 실행용 프롬프트가 아니다.\n각 CodeTask 섹션을 순서대로 개별 실행해야 한다." as const;

export const CODE_TASK_DEVELOPER_PROMPT_COPY_FAILED_MESSAGE =
  "개발 프롬프트를 복사할 수 없습니다.\n선택 CodeTask의 Branch Plan/File Boundary를 확인하세요." as const;

export function orderCodeTaskIdsByBranchPlan(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly codeTaskIds: readonly string[];
}): readonly string[] {
  const wanted = new Set(input.codeTaskIds.map((id) => id.trim()).filter(Boolean));
  if (!wanted.size) return [];
  const sorted = sortCodeTasksByBranchPlanOrder(input.codeTaskPlan).tasks;
  return sorted.map((t) => t.codeTaskId).filter((id) => wanted.has(id));
}

export function buildStageTwoDeveloperPromptBundle(input: {
  readonly projectId: string;
  readonly codeTaskIds: readonly string[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly codeTaskPromptContextMapV1?: CodeTaskPromptContextMapV1 | null;
}): Readonly<{ readonly ok: boolean; readonly content?: string; readonly reason?: string; readonly count?: number }> {
  const ordered = orderCodeTaskIdsByBranchPlan({
    codeTaskPlan: input.codeTaskPlan,
    codeTaskIds: input.codeTaskIds,
  });
  if (!ordered.length) {
    return { ok: false, reason: CODE_TASK_DEVELOPER_PROMPT_COPY_FAILED_MESSAGE };
  }

  const sections: string[] = [];
  for (const codeTaskId of ordered) {
    const result = resolveCodeTaskDeveloperPromptForCopy({
      projectId: input.projectId,
      codeTaskId,
      codeTaskPlan: input.codeTaskPlan,
      taskList: input.taskList,
      cursorWorkItems: input.cursorWorkItems,
      runs: input.runs,
      targetRepository: input.targetRepository,
      baseBranch: input.baseBranch,
      allowedPathGlobs: input.allowedPathGlobs,
      codeTaskPromptContextMapV1: input.codeTaskPromptContextMapV1,
    });
    if (!result.ok || !result.prompt?.trim()) {
      return { ok: false, reason: result.reason ?? CODE_TASK_DEVELOPER_PROMPT_COPY_FAILED_MESSAGE };
    }
    const stageCheck = assertStageTwoDeveloperPromptAllowed({ prompt: result.prompt });
    if (!stageCheck.ok) {
      return { ok: false, reason: CODE_TASK_DEVELOPER_PROMPT_COPY_FAILED_MESSAGE };
    }
    sections.push(result.prompt.trim());
  }

  if (sections.length === 1) {
    return { ok: true, content: sections[0]!, count: 1 };
  }

  const body = sections
    .map((prompt, index) => {
      const n = index + 1;
      return [`# CodeTask ${n}/${sections.length}`, "", prompt].join("\n");
    })
    .join("\n\n---\n\n");

  const content = [
    "# CodeTask Developer Prompt Bundle",
    "",
    "## Bundle Summary",
    `- CodeTask count: ${sections.length}`,
    "- Order: Branch Plan execution order",
    "- Usage: Copy individual section to Cursor one by one. Do not execute bundle as one prompt.",
    "",
    DEVELOPER_PROMPT_BUNDLE_NOT_FOR_CURSOR,
    "",
    "---",
    "",
    body,
  ].join("\n");

  return { ok: true, content, count: sections.length };
}

export function buildStageTwoDeveloperPromptForCodeTask(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly codeTaskPromptContextMapV1?: CodeTaskPromptContextMapV1 | null;
}): GeneratedCodeTaskPromptV1 | null {
  const result = resolveCodeTaskDeveloperPromptForCopy({
    projectId: input.projectId,
    codeTaskId: input.codeTaskId,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
    runs: input.runs,
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch,
    allowedPathGlobs: input.allowedPathGlobs,
    codeTaskPromptContextMapV1: input.codeTaskPromptContextMapV1,
  });
  if (!result.ok || !result.prompt?.trim()) return null;
  return buildGeneratedStageTwoDeveloperPrompt({
    codeTaskId: input.codeTaskId,
    title: input.codeTaskPlan.tasks.find((t) => t.codeTaskId === input.codeTaskId)?.title ?? "",
    content: result.prompt,
    quality: { ready: true, readiness: "ready", missing: [], warnings: [] },
  });
}

export function resolveDeveloperPromptCopyFromSelection(input: {
  readonly projectId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly currentCodeTaskId: string | null;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly targetRepository: ProjectTargetRepository | null;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly codeTaskPromptContextMapV1?: CodeTaskPromptContextMapV1 | null;
}): Readonly<{ readonly ok: boolean; readonly prompt?: string; readonly content?: string; readonly reason?: string; readonly count?: number }> {
  if (!input.targetRepository || !input.codeTaskPlan?.tasks.length) {
    return { ok: false, reason: CODE_TASK_DEVELOPER_PROMPT_COPY_FAILED_MESSAGE };
  }

  const selected = [...new Set(input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean))];
  let ids = selected;
  if (!ids.length) {
    const current = String(input.currentCodeTaskId ?? "").trim();
    if (!current) {
      return { ok: false, reason: CODE_TASK_DEVELOPER_PROMPT_COPY_FAILED_MESSAGE };
    }
    ids = [current];
  }

  const bundle = buildStageTwoDeveloperPromptBundle({
    projectId: input.projectId,
    codeTaskIds: ids,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
    runs: input.runs,
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch,
    allowedPathGlobs: input.allowedPathGlobs,
    codeTaskPromptContextMapV1: input.codeTaskPromptContextMapV1,
  });
  if (!bundle.ok || !bundle.content?.trim()) {
    return { ok: false, reason: bundle.reason ?? CODE_TASK_DEVELOPER_PROMPT_COPY_FAILED_MESSAGE };
  }
  const prompt = bundle.content.trim();
  return { ok: true, prompt, content: prompt, count: bundle.count };
}

export function formatDeveloperPromptBundleCopySuccessToast(count: number): string {
  if (count <= 1) {
    return "현재 CodeTask 개발 프롬프트를 복사했습니다.";
  }
  return `선택한 CodeTask ${count}개의 개발 프롬프트를 복사했습니다.\n각 프롬프트는 순서대로 개별 실행하세요.`;
}

export function formatDeveloperPromptAllSelectedCopySuccessToast(count: number): string {
  return `전체 CodeTask ${count}개의 개발 프롬프트 묶음을 복사했습니다.\nCursor 실행은 각 CodeTask를 순서대로 개별 실행하세요.`;
}

export function formatDeveloperPromptSingleCopySuccessToast(codeTaskId: string): string {
  const id = codeTaskId.trim();
  return id ? `${id} 개발 프롬프트를 복사했습니다.` : "현재 CodeTask 개발 프롬프트를 복사했습니다.";
}

export function formatDeveloperPromptHeaderCopySuccessToast(input: {
  readonly count: number;
  readonly selectedCodeTaskIds: readonly string[];
  readonly totalCodeTaskCount: number;
}): string {
  const selected = input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  const total = Math.max(0, input.totalCodeTaskCount);
  const count = input.count;
  if (count <= 1) {
    if (selected.length === 1) {
      return formatDeveloperPromptSingleCopySuccessToast(selected[0]!);
    }
    return "현재 CodeTask 개발 프롬프트를 복사했습니다.";
  }
  if (total > 1 && selected.length >= total && count >= total) {
    return formatDeveloperPromptAllSelectedCopySuccessToast(total);
  }
  return formatDeveloperPromptBundleCopySuccessToast(count);
}
