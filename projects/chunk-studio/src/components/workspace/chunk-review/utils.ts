import type { ChunkDTO, Job } from "@/types/job";
import type { ChunkQualityStatus } from "@/lib/analysis/chunkQualityAnalyzer";

export type ChunkFilter = "all" | "needs-review" | "edited" | "noise" | "long" | "short";

export function toStatusGroup(status: Job["status"] | undefined) {
  if (!status) return "idle" as const;
  if (status === "FAILED") return "failed" as const;
  if (status === "DONE") return "done" as const;
  if (["QUEUED", "CONVERTING", "PDF_READY", "EXTRACTING_TEXT", "CHUNKING"].includes(status)) {
    return "processing" as const;
  }
  return "idle" as const;
}

export function processingMessage(status: Job["status"] | undefined) {
  return status === "QUEUED" ? "문서를 분석 대기 중입니다." : "문서를 분석 중입니다.";
}

export function resolveUiStatus(
  chunk: ChunkDTO,
  analyzed: ChunkQualityStatus,
  modified: Set<string>
) {
  if (modified.has(chunk.meta.chunkId)) return "수정됨";
  if (analyzed === "NOISE_SUSPECTED") return "노이즈 의심";
  if (analyzed === "TOO_LONG") return "긴 청크";
  if (analyzed === "TOO_SHORT") return "짧은 청크";
  if (analyzed === "REVIEW_REQUIRED") return "검토 필요";
  return "정상";
}

export function findMergeTarget(current: ChunkDTO, chunks: ChunkDTO[]): ChunkDTO | null {
  const index = chunks.findIndex((chunk) => chunk.meta.chunkId === current.meta.chunkId);
  if (index < 0) return null;
  const next = chunks[index + 1] ?? null;
  const prev = chunks[index - 1] ?? null;
  if (next && isSameSection(current, next)) return next;
  if (prev && isSameSection(current, prev)) return prev;
  return next ?? prev ?? null;
}

export function buildMergedPreview(a: ChunkDTO, b: ChunkDTO): string {
  const merged = `${a.text}\n${b.text}`.replace(/\s+/g, " ").trim();
  return `${merged.slice(0, 320)}${merged.length > 320 ? "..." : ""}`;
}

function isSameSection(a: ChunkDTO, b: ChunkDTO): boolean {
  return a.meta.sectionPath.join(" > ") === b.meta.sectionPath.join(" > ");
}
