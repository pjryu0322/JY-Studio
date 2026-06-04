import { resolveCodeTaskDeveloperPromptForCopy } from "@/lib/prototype/resolveCodeTaskDeveloperPromptForCopy";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { resolveProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export type BuildAllCodeTaskDeveloperPromptsForCopyResult =
  | Readonly<{ readonly ok: true; readonly text: string; readonly copiedCount: number }>
  | Readonly<{ readonly ok: false; readonly reason: string }>;

/**
 * 구현 보드 클립보드용: CodeTask별 **별도** Runtime Cursor 프롬프트를 묶어 복사한다.
 * Cursor API 실행/디스패치는 항상 단일 CodeTask(`resolveCodeTaskDeveloperPromptForCopy`)만 사용한다.
 */
export function buildAllCodeTaskDeveloperPromptsForCopy(input: {
  readonly projectId: string;
  readonly requirementsStateJson: RequirementsStateJson;
  readonly projectSettings?: unknown;
  /** 구현 실행 설정(execution setup)의 repo — 단건 복사와 동일 우선순위 */
  readonly envSettings?: unknown;
  readonly baseBranch?: string | null;
  readonly allowedPathGlobs?: readonly string[] | null;
}): BuildAllCodeTaskDeveloperPromptsForCopyResult {
  const pid = input.projectId.trim();
  const state = input.requirementsStateJson;
  const codeTaskPlan = parseImplementationCodeTaskPlanV1(state.implementationCodeTaskPlanV1);
  if (!codeTaskPlan?.tasks.length) {
    return { ok: false, reason: "복사할 CodeTask가 없습니다." };
  }

  const targetRepository = resolveProjectTargetRepository({
    requirementsStateJson: state,
    projectSettings: input.projectSettings,
    envSettings: input.envSettings,
  });
  if (!targetRepository) {
    return { ok: false, reason: "GitHub 저장소 설정이 없어 프롬프트를 생성할 수 없습니다." };
  }

  const baseBranch =
    String(input.baseBranch ?? "").trim() || targetRepository.defaultBranch || "main";
  const allowedPathGlobs = input.allowedPathGlobs ?? undefined;
  const taskList = parseImplementationTaskListV1(state.implementationTaskListV1);
  const cursorWorkItems = state.cursorWorkItemsV1 ?? [];
  const runs = parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [];
  const map = state.codeTaskPromptContextMapV1 ?? null;

  const sections: string[] = [];
  let copiedCount = 0;

  for (const codeTask of codeTaskPlan.tasks) {
    const codeTaskId = codeTask.codeTaskId.trim();
    if (!codeTaskId) continue;
    const result = resolveCodeTaskDeveloperPromptForCopy({
      projectId: pid,
      codeTaskId,
      codeTaskPlan,
      taskList,
      cursorWorkItems,
      runs,
      targetRepository,
      baseBranch,
      allowedPathGlobs,
      codeTaskPromptContextMapV1: map,
    });
    if (!result.ok || !result.prompt?.trim()) {
      return {
        ok: false,
        reason: result.reason ?? `CodeTask ${codeTaskId} 프롬프트를 만들 수 없습니다.`,
      };
    }
    sections.push(
      `# ${codeTask.title.trim() || codeTaskId}`,
      `CodeTask ID: ${codeTaskId}`,
      "",
      result.prompt.trim(),
    );
    copiedCount += 1;
  }

  if (!copiedCount) {
    return { ok: false, reason: "복사할 CodeTask 프롬프트가 없습니다." };
  }

  return {
    ok: true,
    text: sections.join("\n\n---\n\n"),
    copiedCount,
  };
}
