import type { PackChunksListResponse } from "@/lib/chunk-pipeline-dto";

type ChunkSourceDocumentListProps = {
  sourceDocuments: PackChunksListResponse["sourceDocuments"];
  generatingId: string | null;
  onGenerate: (sourceDocumentId: string) => void | Promise<void>;
};

export function ChunkSourceDocumentList({
  sourceDocuments,
  generatingId,
  onGenerate,
}: ChunkSourceDocumentListProps) {
  if (!sourceDocuments.length) {
    return <p className="text-sm text-store-muted">원천 문서가 없습니다.</p>;
  }

  return (
    <ul className="space-y-2">
      {sourceDocuments.map((doc) => (
        <li
          key={doc.id}
          className="flex flex-col gap-2 rounded-xl border border-store-border p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{doc.title}</p>
            <p className="text-xs text-store-muted">
              {doc.sourceType} · chunk {doc.chunkCount}개
            </p>
          </div>
          <button
            type="button"
            disabled={generatingId === doc.id}
            onClick={() => void onGenerate(doc.id)}
            className="min-h-[44px] shrink-0 rounded-xl border border-store-border bg-white px-3 text-xs font-semibold disabled:opacity-50"
          >
            {generatingId === doc.id ? "생성 중…" : "이 문서에서 chunk 생성"}
          </button>
        </li>
      ))}
    </ul>
  );
}
