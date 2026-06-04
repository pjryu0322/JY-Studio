import type { CodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

/** 화면 선택과 동일한 순서: 실행 중 Job DB 필드가 SoT, 없을 때만 JSON 큐 목록. */
export function resolveSelectedCodeTaskIdsForContinuation(input: {
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly legacyQueue?: CodeTaskExecutionQueueV1 | null;
}): readonly string[] {
  const jobIds = input.dbBundle?.job?.selectedCodeTaskIds ?? [];
  if (jobIds.length) {
    return jobIds.map((id) => id.trim()).filter(Boolean);
  }
  if (input.legacyQueue?.status === "running") {
    return input.legacyQueue.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  }
  return [];
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
  readonly queue?: CodeTaskExecutionQueueV1 | null;
}): string | null {
  const selectedCodeTaskIds = resolveSelectedCodeTaskIdsForContinuation({
    dbBundle: input.dbBundle,
    legacyQueue: input.queue ?? null,
  });
  return resolveNextCodeTaskIdAfterCompletion({
    selectedCodeTaskIds,
    completedCodeTaskId: input.completedCodeTaskId,
  });
}
