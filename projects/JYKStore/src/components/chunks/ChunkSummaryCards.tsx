import type { PackChunksListResponse } from "@/lib/chunk-pipeline-dto";

type ChunkSummaryCardsProps = {
  summary: NonNullable<PackChunksListResponse["summary"]>;
};

export function ChunkSummaryCards({ summary }: ChunkSummaryCardsProps) {
  return (
    <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
      <div>버전: {summary.versionCount}</div>
      <div>원천 문서: {summary.sourceDocumentCount}</div>
      <div>전체 chunk: {summary.chunkCount}</div>
      <div>활성: {summary.activeChunkCount}</div>
      <div>비활성: {summary.inactiveChunkCount}</div>
    </dl>
  );
}
