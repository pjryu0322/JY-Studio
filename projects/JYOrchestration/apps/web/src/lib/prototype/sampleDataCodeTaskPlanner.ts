import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID, LEGACY_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import type { CodeTaskPromptContextV1 } from "@/lib/prototype/codeTaskPromptContext";
import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import {
  inferCodeTaskFileBoundary,
  SAMPLE_DATA_OWNED_PATTERNS,
} from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import { resolveCodeTaskSpecificRole } from "@/lib/prototype/codeTaskPromptRoleResolver";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

/** Process-task id in implementation task list (sample data foundation). */
export const SAMPLE_DATA_PARENT_PROCESS_TASK_ID = "DEV-MOCK-001" as const;

/** Production CodeTask id for meeting / workspace sample data (P3-08A). */
export const SAMPLE_DATA_CODE_TASK_ID = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;

/**
 * Sample data SoT (repo + git):
 * - Work branch: {@link SAMPLE_DATA_WORK_BRANCH} only (CodeTask 실행·산출물·통합 merge 대상).
 * - Repo files: {@link SAMPLE_DATA_OWNED_FILE_PATHS} only — 다른 경로는 Preview/통합에서 인정하지 않음.
 */
export const SAMPLE_DATA_WORK_BRANCH = "wip/data/sample-data" as const;

export const SAMPLE_DATA_CANONICAL_FILES = {
  sampleData: "src/data/sampleData.ts",
  meetingTypes: "src/types/meeting.ts",
} as const;

export const SAMPLE_DATA_PRIMARY_FILE_PATH = SAMPLE_DATA_CANONICAL_FILES.sampleData;

export const SAMPLE_DATA_OWNED_FILE_PATHS = [
  SAMPLE_DATA_CANONICAL_FILES.sampleData,
  SAMPLE_DATA_CANONICAL_FILES.meetingTypes,
] as const;

export function areSampleDataOwnedFilesOnBranch(filePaths: readonly string[]): boolean {
  const paths = new Set(filePaths.map((p) => p.replace(/\\/g, "/")));
  return SAMPLE_DATA_OWNED_FILE_PATHS.every((owned) => paths.has(owned));
}

export const SAMPLE_DATA_EXPECTED_EXPORTS = [
  "sampleMeetingFiles",
  "sampleParticipants",
  "sampleTranscriptSegments",
  "sampleMeetingSummary",
  "sampleDecisions",
  "sampleActionItems",
  "sampleDraftTimeline",
] as const;

/** Stored prompt context가 구(패널 직접 연결) 템플릿이면 quick-run prep에서 다시 생성한다. */
export const STALE_SAMPLE_DATA_PROMPT_CONTEXT_MARKERS = [
  "각 화면 패널은 sampleData.ts를 import",
  "좌/중/우 패널이 동일 sampleData.ts를 참조",
] as const;

export function storedSampleDataPromptContextIsStale(
  context: CodeTaskPromptContextV1 | null | undefined,
): boolean {
  if (!context) return true;
  const hay = [
    context.implementationContext?.requirements?.join("\n") ?? "",
    context.implementationContext?.intent ?? "",
    context.verificationContext?.acceptanceCriteria?.join("\n") ?? "",
    context.verificationContext?.manualChecks?.join("\n") ?? "",
  ].join("\n");
  return STALE_SAMPLE_DATA_PROMPT_CONTEXT_MARKERS.some((marker) => hay.includes(marker));
}

/** Plan task 대비 prompt context map에 새로 채우거나(누락) 샘플 데이터 구템플릿을 갱신할 CodeTask id. */
export function listCodeTaskPromptContextIdsToRefresh(input: {
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly existingContexts: Readonly<Record<string, CodeTaskPromptContextV1>>;
}): readonly string[] {
  const ids: string[] = [];
  for (const task of input.plan.tasks) {
    const id = task.codeTaskId.trim();
    if (!id) continue;
    const existing = input.existingContexts[id];
    if (!existing) {
      ids.push(id);
      continue;
    }
    if (sampleDataPromptContextNeedsRefreshForTask(task, existing)) {
      ids.push(id);
    }
  }
  return ids;
}

function sampleDataPromptContextNeedsRefreshForTask(
  task: ImplementationCodeTaskV1,
  context: CodeTaskPromptContextV1,
): boolean {
  return (
    isSampleDataCodeTaskRef({
      codeTaskId: task.codeTaskId,
      parentTaskId: task.parentTaskId,
      title: task.title,
      changeType: task.changeType,
    }) && storedSampleDataPromptContextIsStale(context)
  );
}

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
  if (id === LEGACY_SAMPLE_DATA_CODE_TASK_ID) return true;
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

function sampleDataFileBoundaryCoversRequiredPatterns(
  boundary: ReturnType<typeof parseCodeTaskFileBoundaryV1>,
): boolean {
  if (!boundary) return false;
  const owned = [...(boundary.ownedFiles ?? []), ...(boundary.expectedFiles ?? [])];
  return SAMPLE_DATA_OWNED_PATTERNS.every((pattern) => owned.includes(pattern));
}

/** 저장된 plan에 샘플 데이터 Task 경계가 구버전(owned 누락)이면 mock_data 경계로 다시 맞춘다. */
export function repairSampleDataCodeTaskFileBoundariesInPlan(
  plan: ImplementationCodeTaskPlanV1,
): ImplementationCodeTaskPlanV1 {
  let changed = false;
  const tasks = plan.tasks.map((task) => {
    if (
      !isSampleDataCodeTaskRef({
        codeTaskId: task.codeTaskId,
        parentTaskId: task.parentTaskId,
        title: task.title,
        changeType: task.changeType,
      })
    ) {
      return task;
    }
    const boundary = parseCodeTaskFileBoundaryV1(task.fileBoundary);
    if (sampleDataFileBoundaryCoversRequiredPatterns(boundary)) return task;
    const inferred = inferCodeTaskFileBoundary({ codeTask: task });
    changed = true;
    const forbiddenPaths = [
      ...new Set([...(task.forbiddenPaths ?? []), ...inferred.forbiddenFiles.slice(0, 12)]),
    ];
    return { ...task, fileBoundary: inferred, forbiddenPaths };
  });
  if (!changed) return plan;
  return { ...plan, tasks, updatedAt: new Date().toISOString() };
}
