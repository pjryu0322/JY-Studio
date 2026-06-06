import {
  buildGeneratedStageOnePlanningSummaryPrompt,
  type GeneratedCodeTaskPromptV1,
} from "@/lib/prototype/generatedCodeTaskPrompt";
import { resolveCodeTaskPromptDraftForCopy } from "@/lib/prototype/resolveCodeTaskPromptDraftForCopy";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskPromptContextMapV1 } from "@/lib/prototype/codeTaskPromptContext";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export function buildStageOneCodeTaskPlanningSummaryPrompt(input: {
  readonly projectId: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly taskList: ImplementationTaskListV1 | null | undefined;
  readonly codeTaskPromptContextMapV1?: CodeTaskPromptContextMapV1 | null;
  readonly templateId?: string | null;
}): GeneratedCodeTaskPromptV1 {
  const resolved = resolveCodeTaskPromptDraftForCopy({
    projectId: input.projectId,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    codeTaskPromptContextMapV1: input.codeTaskPromptContextMapV1,
    mode: "all",
    templateId: input.templateId,
  });
  if (!resolved.ok || !resolved.prompt) {
    return buildGeneratedStageOnePlanningSummaryPrompt({
      content: "",
      ready: false,
    });
  }
  return buildGeneratedStageOnePlanningSummaryPrompt({
    content: resolved.prompt,
    ready: true,
  });
}
