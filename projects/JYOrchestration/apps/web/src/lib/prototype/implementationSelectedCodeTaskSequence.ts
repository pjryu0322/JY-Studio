import { parseCodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

export type SelectedCodeTaskIdsContinuationSource = "db_job" | "code_task_queue" | "reconciled";

export type ResolveSelectedCodeTaskIdsForContinuationContextResult = Readonly<{
  readonly selectedCodeTaskIds: readonly string[];
  readonly source: SelectedCodeTaskIdsContinuationSource;
  readonly dbSelectedCount: number;
  readonly runtimeSelectedCount: number;
  readonly resolvedSelectedCount: number;
}>;

/** Job에 저장된 선택(과거 readyIds만 넣은 버그 등)을 보드 체크박스 선택과 합친다. Job 순서 유지, 보드에만 있는 id는 보드 순서로 뒤에 붙인다. */
export function reconcileJobSelectedCodeTaskIdsWithBoardSelection(input: {
  readonly jobSelectedCodeTaskIds: readonly string[];
  readonly boardSelectedCodeTaskIds: readonly string[];
}): readonly string[] {
  const job = input.jobSelectedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  const board = input.boardSelectedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  if (!board.length) return job;
  if (!job.length) return board;
  const seen = new Set(job);
  const merged = [...job];
  for (const id of board) {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }
  return merged;
}

export function jobSelectedCodeTaskIdsNeedBoardReconcile(input: {
  readonly jobSelectedCodeTaskIds: readonly string[];
  readonly boardSelectedCodeTaskIds: readonly string[];
}): boolean {
  const reconciled = reconcileJobSelectedCodeTaskIdsWithBoardSelection(input);
  const job = input.jobSelectedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  return reconciled.length > job.length;
}

/** DB job → 실행 큐(JSON) 순으로 선택 목록을 복원하고, job이 짧으면 큐와 reconcile한다. */
export function resolveSelectedCodeTaskIdsForContinuationContext(input: {
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly codeTaskExecutionQueueV1?: unknown;
}): ResolveSelectedCodeTaskIdsForContinuationContextResult {
  const jobIds = (input.dbBundle?.job?.selectedCodeTaskIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  const queue = parseCodeTaskExecutionQueueV1(input.codeTaskExecutionQueueV1);
  const queueIds =
    queue && queue.status !== "idle"
      ? queue.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean)
      : [];

  if (jobIds.length) {
    const reconciled = reconcileJobSelectedCodeTaskIdsWithBoardSelection({
      jobSelectedCodeTaskIds: jobIds,
      boardSelectedCodeTaskIds: queueIds,
    });
    const needsReconcile = jobSelectedCodeTaskIdsNeedBoardReconcile({
      jobSelectedCodeTaskIds: jobIds,
      boardSelectedCodeTaskIds: queueIds,
    });
    return {
      selectedCodeTaskIds: reconciled,
      source: needsReconcile ? "reconciled" : "db_job",
      dbSelectedCount: jobIds.length,
      runtimeSelectedCount: queueIds.length,
      resolvedSelectedCount: reconciled.length,
    };
  }

  if (queueIds.length) {
    return {
      selectedCodeTaskIds: queueIds,
      source: "code_task_queue",
      dbSelectedCount: 0,
      runtimeSelectedCount: queueIds.length,
      resolvedSelectedCount: queueIds.length,
    };
  }

  return {
    selectedCodeTaskIds: [],
    source: "db_job",
    dbSelectedCount: 0,
    runtimeSelectedCount: queueIds.length,
    resolvedSelectedCount: 0,
  };
}

/** 실행 중 Job DB 필드 우선, 없으면 code task execution queue. */
export function resolveSelectedCodeTaskIdsForContinuation(input: {
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly codeTaskExecutionQueueV1?: unknown;
}): readonly string[] {
  return resolveSelectedCodeTaskIdsForContinuationContext(input).selectedCodeTaskIds;
}

/** 완료한 CodeTask 다음 항목 (선택 배열 기준, N회 반복의 유일한 규칙). */
export function resolveNextCodeTaskIdAfterCompletion(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly completedCodeTaskId: string | null;
}): string | null {
  const ids = input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  const completed = input.completedCodeTaskId?.trim() ?? "";
  if (!ids.length || !completed) return null;
  const idx = ids.indexOf(completed);
  if (idx < 0 || idx + 1 >= ids.length) return null;
  return ids[idx + 1] ?? null;
}

export function resolveNextQuickRunCodeTaskId(input: {
  readonly completedCodeTaskId: string | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly codeTaskExecutionQueueV1?: unknown;
}): string | null {
  const selectedCodeTaskIds = resolveSelectedCodeTaskIdsForContinuation({
    dbBundle: input.dbBundle,
    codeTaskExecutionQueueV1: input.codeTaskExecutionQueueV1,
  });
  return resolveNextCodeTaskIdAfterCompletion({
    selectedCodeTaskIds,
    completedCodeTaskId: input.completedCodeTaskId,
  });
}
