import { validateCodeTaskPromptDraftSafety } from "@/lib/prototype/codeTaskPromptDraftSafety";
import {
  formatCodeTaskPromptDraft,
  formatCodeTaskPromptDraftBundle,
} from "@/lib/prototype/formatCodeTaskPromptDraft";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  getCodeTaskPromptContextFromMap,
  parseCodeTaskPromptContextMapV1,
  type CodeTaskPromptContextMapV1,
} from "@/lib/prototype/codeTaskPromptContext";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { parseImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import { prepareCodeTaskPlanForStageOnePrompt } from "@/lib/prototype/prepareCodeTaskPlanForStageOnePrompt";

export const CODE_TASK_PROMPT_DRAFT_NOT_READY_MESSAGE =
  "CodeTask 프롬프트 초안이 아직 준비되지 않았습니다." as const;

export function resolveCodeTaskPromptDraftForCopy(input: {
  readonly projectId: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly taskList: ImplementationTaskListV1 | null | undefined;
  readonly codeTaskPromptContextMapV1?: CodeTaskPromptContextMapV1 | null | undefined;
  readonly mode: "all" | "single";
  readonly codeTaskId?: string | null;
  readonly templateId?: string | null;
}): Readonly<{ readonly ok: boolean; readonly prompt?: string; readonly reason?: string }> {
  const parsedPlan = input.codeTaskPlan ?? null;
  if (!parsedPlan?.tasks.length) {
    return { ok: false, reason: CODE_TASK_PROMPT_DRAFT_NOT_READY_MESSAGE };
  }

  const taskList = parseImplementationTaskListV1(input.taskList ?? undefined);
  const map = parseCodeTaskPromptContextMapV1(input.codeTaskPromptContextMapV1 ?? undefined);

  const prepared = prepareCodeTaskPlanForStageOnePrompt({
    projectId: input.projectId.trim(),
    baseBranch: "main",
    plan: parsedPlan,
    taskList,
  });
  const planForPrompt = prepared.plan;
  if (!prepared.readiness.ready && prepared.readiness.blocking) {
    return { ok: false, reason: CODE_TASK_PROMPT_DRAFT_NOT_READY_MESSAGE };
  }

  let draft = "";
  const templateId = String(input.templateId ?? "").trim() || undefined;

  if (input.mode === "all") {
    draft = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: planForPrompt,
      taskList,
      promptContextMap: map,
      templateId,
    });
  } else {
    const codeTaskId = String(input.codeTaskId ?? "").trim();
    if (!codeTaskId) {
      return { ok: false, reason: CODE_TASK_PROMPT_DRAFT_NOT_READY_MESSAGE };
    }
    const codeTask = planForPrompt.tasks.find((t) => t.codeTaskId === codeTaskId);
    if (!codeTask) {
      return { ok: false, reason: CODE_TASK_PROMPT_DRAFT_NOT_READY_MESSAGE };
    }
    const parentTask = taskList?.tasks.find((t) => t.taskId === codeTask.parentTaskId) ?? null;
    const ctx = getCodeTaskPromptContextFromMap(map, codeTaskId);
    draft = formatCodeTaskPromptDraft({
      codeTask,
      parentTask,
      promptContext: ctx,
      templateId,
    });
  }

  const safety = validateCodeTaskPromptDraftSafety({ prompt: draft });
  if (!safety.ok) {
    return { ok: false, reason: CODE_TASK_PROMPT_DRAFT_NOT_READY_MESSAGE };
  }

  return { ok: true, prompt: draft };
}

/** requirementsStateJson에서 기획단계 Draft 복사용 payload 조합 */
export function resolveCodeTaskPromptDraftForCopyFromState(input: {
  readonly requirementsStateJson: Record<string, unknown>;
  readonly mode: "all" | "single";
  readonly codeTaskId?: string | null;
}): Readonly<{ readonly ok: boolean; readonly prompt?: string; readonly reason?: string }> {
  const projectId = String(input.requirementsStateJson.projectId ?? "").trim();
  const seed = parseImplementationSeedV1(input.requirementsStateJson.implementationSeedV1);
  const templateId = seed?.templateContext?.templateId?.trim() || undefined;
  return resolveCodeTaskPromptDraftForCopy({
    projectId,
    codeTaskPlan: parseImplementationCodeTaskPlanV1(input.requirementsStateJson.implementationCodeTaskPlanV1),
    taskList: parseImplementationTaskListV1(input.requirementsStateJson.implementationTaskListV1),
    codeTaskPromptContextMapV1: parseCodeTaskPromptContextMapV1(
      input.requirementsStateJson.codeTaskPromptContextMapV1,
    ),
    mode: input.mode,
    codeTaskId: input.codeTaskId,
    templateId,
  });
}
