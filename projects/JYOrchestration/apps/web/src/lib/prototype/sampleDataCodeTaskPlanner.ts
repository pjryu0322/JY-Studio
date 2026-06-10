import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { resolveCodeTaskSpecificRole } from "@/lib/prototype/codeTaskPromptRoleResolver";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

/** Process-task id in implementation task list (sample data foundation). */
export const SAMPLE_DATA_PARENT_PROCESS_TASK_ID = "DEV-MOCK-001" as const;

/** Production CodeTask id for meeting / workspace sample data (P3-08A). */
export const SAMPLE_DATA_CODE_TASK_ID = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;

export const SAMPLE_DATA_WORK_BRANCH = "wip/data/sample-data" as const;

export const SAMPLE_DATA_OWNED_FILE_PATHS = [
  "src/data/sampleData.ts",
  "src/types/meeting.ts",
] as const;

export const SAMPLE_DATA_EXPECTED_EXPORTS = [
  "sampleMeetingFiles",
  "sampleParticipants",
  "sampleTranscriptSegments",
  "sampleMeetingSummary",
  "sampleDecisions",
  "sampleActionItems",
  "sampleDraftTimeline",
] as const;

export const ACTUAL_PREVIEW_SAMPLE_DATA_REQUIRED_USER_MESSAGE =
  "Preview에 표시할 샘플데이터가 아직 준비되지 않았습니다.\n샘플데이터 작업을 완료한 뒤 다시 통합 및 Preview 준비를 실행해 주세요." as const;

export function isSampleDataCodeTaskRef(input: {
  readonly codeTaskId: string;
  readonly parentTaskId?: string | null;
  readonly title?: string | null;
  readonly changeType?: string | null;
}): boolean {
  const id = input.codeTaskId.trim();
  if (id === SAMPLE_DATA_CODE_TASK_ID) return true;
  const parent = String(input.parentTaskId ?? "").trim();
  if (parent === SAMPLE_DATA_PARENT_PROCESS_TASK_ID) return true;
  const role = resolveCodeTaskSpecificRole({
    codeTaskTitle: String(input.title ?? ""),
    changeType: input.changeType ?? undefined,
  });
  return role.roleKind === "mock_data";
}

export function listSampleDataCodeTaskIdsFromPlan(
  codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined,
  taskList?: ImplementationTaskListV1 | null,
): readonly string[] {
  const tasks = codeTaskPlan?.tasks ?? [];
  if (!tasks.length) return [];
  const parentTitleById = new Map(
    (taskList?.tasks ?? []).map((t) => [t.taskId, t.title] as const),
  );
  const ids: string[] = [];
  for (const task of tasks) {
    const branchGroup = parseCodeTaskBranchPlanV1(task.branchPlan)?.branchGroup ?? "";
    if (
      isSampleDataCodeTaskRef({
        codeTaskId: task.codeTaskId,
        parentTaskId: task.parentTaskId,
        title: task.title,
        changeType: task.changeType,
      }) ||
      branchGroup === "data"
    ) {
      ids.push(task.codeTaskId.trim());
    } else if (
      resolveCodeTaskSpecificRole({
        codeTaskTitle: task.title,
        parentTaskTitle: parentTitleById.get(task.parentTaskId),
        changeType: task.changeType,
      }).roleKind === "mock_data"
    ) {
      ids.push(task.codeTaskId.trim());
    }
  }
  return [...new Set(ids.filter(Boolean))];
}

/** When screen/feature CodeTasks are selected, sample data CodeTask must be included for actual Preview. */
export function ensureSampleDataCodeTaskIncludedInSelection(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly taskList?: ImplementationTaskListV1 | null;
}): readonly string[] {
  const selected = [...new Set(input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean))];
  if (!selected.length || !input.codeTaskPlan) return selected;

  const sampleIds = listSampleDataCodeTaskIdsFromPlan(input.codeTaskPlan, input.taskList);
  if (!sampleIds.length) return selected;

  const plan = input.codeTaskPlan;
  const needsSample = selected.some((id) => {
    const task = plan.tasks.find((t) => t.codeTaskId.trim() === id);
    if (!task) return false;
    if (isSampleDataCodeTaskRef(task)) return false;
    const role = resolveCodeTaskSpecificRole({
      codeTaskTitle: task.title,
      changeType: task.changeType,
    });
    return (
      role.roleKind.startsWith("screen_") ||
      role.roleKind.startsWith("feature_") ||
      task.changeType === "component"
    );
  });

  if (!needsSample) return selected;

  const merged = new Set(selected);
  for (const id of sampleIds) merged.add(id);
  return [...merged];
}
