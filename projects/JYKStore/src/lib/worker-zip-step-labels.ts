/**
 * P7.5: client-safe step catalog + formatting for the Admin ZIP Worker UI.
 *
 * Mirrors the ordered UI steps in `worker-zip-step-log.ts` (server) but without a
 * Prisma import, so client components can render the stepper / history. Keep the
 * two lists in sync (both derive from PipelineStatus stage mapping).
 */
export const WORKER_ZIP_UI_STEP_ORDER: { step: string; label: string }[] = [
  { step: "SOURCE_REGISTERING", label: "접수" },
  { step: "SOURCE_VALIDATING", label: "ZIP 확인" },
  { step: "STRUCTURING", label: "문서 구조화" },
  { step: "STRUCTURE_VALIDATING", label: "구조 검증" },
  { step: "KNOWLEDGE_CHECKING", label: "지식 점검" },
  { step: "CHUNKING", label: "검색데이터 준비" },
  { step: "CHUNK_EVALUATING", label: "검색데이터 반영" },
  { step: "INDEXING", label: "검색 인덱스" },
];

const STEP_LABEL = new Map<string, string>(
  WORKER_ZIP_UI_STEP_ORDER.map((s) => [s.step, s.label]),
);

export function describeWorkerZipStepLabel(step: string | null | undefined): string {
  if (!step) return "";
  return STEP_LABEL.get(step) ?? step;
}

/** Index of a step in the ordered UI list, or -1 when unknown. */
export function workerZipStepIndex(step: string | null | undefined): number {
  if (!step) return -1;
  return WORKER_ZIP_UI_STEP_ORDER.findIndex((s) => s.step === step);
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
