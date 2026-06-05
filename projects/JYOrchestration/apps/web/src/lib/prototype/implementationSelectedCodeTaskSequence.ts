import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

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

/** 실행 중 Job DB 필드가 SoT. */
export function resolveSelectedCodeTaskIdsForContinuation(input: {
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
}): readonly string[] {
  const jobIds = input.dbBundle?.job?.selectedCodeTaskIds ?? [];
  return jobIds.map((id) => id.trim()).filter(Boolean);
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
}): string | null {
  const selectedCodeTaskIds = resolveSelectedCodeTaskIdsForContinuation({
    dbBundle: input.dbBundle,
  });
  return resolveNextCodeTaskIdAfterCompletion({
    selectedCodeTaskIds,
    completedCodeTaskId: input.completedCodeTaskId,
  });
}
