const DEFAULT_CODE_TASK_LLM_BATCH_CONCURRENCY = 3;
const MIN_CODE_TASK_LLM_BATCH_CONCURRENCY = 1;
const MAX_CODE_TASK_LLM_BATCH_CONCURRENCY = 5;

export function resolveCodeTaskLlmBatchConcurrency(
  raw: string | number | null | undefined = process.env.JYO_CODE_TASK_LLM_BATCH_CONCURRENCY,
): number {
  const parsed =
    typeof raw === "number"
      ? raw
      : Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_CODE_TASK_LLM_BATCH_CONCURRENCY;
  return Math.min(
    MAX_CODE_TASK_LLM_BATCH_CONCURRENCY,
    Math.max(MIN_CODE_TASK_LLM_BATCH_CONCURRENCY, Math.floor(parsed)),
  );
}

export {
  DEFAULT_CODE_TASK_LLM_BATCH_CONCURRENCY,
  MAX_CODE_TASK_LLM_BATCH_CONCURRENCY,
  MIN_CODE_TASK_LLM_BATCH_CONCURRENCY,
};
