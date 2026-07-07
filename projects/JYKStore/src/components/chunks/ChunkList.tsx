"use client";

import type { KnowledgeChunkDto } from "@/lib/chunk-pipeline-dto";
import { formatMetadataSummary } from "./chunk-ui-utils";
import { ChunkEditForm, type ChunkEditFormValues } from "./ChunkEditForm";

type ChunkListProps = {
  chunks: KnowledgeChunkDto[];
  hasAnyChunks: boolean;
  isSelected: (chunkId: string) => boolean;
  onToggleSelect: (chunkId: string) => void;
  editingId: string | null;
  onStartEdit: (chunkId: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (chunkId: string, values: ChunkEditFormValues) => void | Promise<void>;
  onDeactivate: (chunkId: string) => void;
};

export function ChunkList({
  chunks,
  hasAnyChunks,
  isSelected,
  onToggleSelect,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDeactivate,
}: ChunkListProps) {
  if (!hasAnyChunks) {
    return <p className="text-sm text-store-muted">등록된 chunk가 없습니다.</p>;
  }
  if (chunks.length === 0) {
    return <p className="text-sm text-store-muted">검색 조건에 맞는 chunk가 없습니다.</p>;
  }

  return (
    <>
      {chunks.map((chunk) => (
        <div
          key={chunk.id}
          className={`rounded-xl border p-3 ${chunk.isActive ? "border-store-border" : "border-slate-200 opacity-70"}`}
        >
          {editingId === chunk.id ? (
            <ChunkEditForm chunk={chunk} onSave={onSaveEdit} onCancel={onCancelEdit} />
          ) : (
            <ChunkDisplayCard
              chunk={chunk}
              selected={isSelected(chunk.id)}
              onToggleSelect={() => onToggleSelect(chunk.id)}
              onStartEdit={() => onStartEdit(chunk.id)}
              onDeactivate={() => onDeactivate(chunk.id)}
            />
          )}
        </div>
      ))}
    </>
  );
}

function ChunkDisplayCard({
  chunk,
  selected,
  onToggleSelect,
  onStartEdit,
  onDeactivate,
}: {
  chunk: KnowledgeChunkDto;
  selected: boolean;
  onToggleSelect: () => void;
  onStartEdit: () => void;
  onDeactivate: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4"
          aria-label="chunk 선택"
        />
        <p className="font-semibold text-slate-900">{chunk.title}</p>
        <span className="text-[10px] text-store-muted">{chunk.chunkType}</span>
        {!chunk.isActive ? <span className="text-[10px] font-bold text-red-700">비활성</span> : null}
      </div>
      <p className="text-xs text-store-muted">
        sortOrder {chunk.sortOrder}
        {chunk.section ? ` · section: ${chunk.section}` : ""}
      </p>
      {chunk.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {chunk.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {chunk.metadata && Object.keys(chunk.metadata).length > 0 ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
          metadata · {formatMetadataSummary(chunk.metadata)}
        </p>
      ) : null}
      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-slate-700">{chunk.content}</pre>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onStartEdit}
          className="min-h-[44px] flex-1 rounded-lg border border-store-border text-xs font-semibold"
        >
          수정
        </button>
        {chunk.isActive ? (
          <button
            type="button"
            onClick={onDeactivate}
            className="min-h-[44px] flex-1 rounded-lg border border-red-200 text-xs font-semibold text-red-800"
          >
            비활성화
          </button>
        ) : null}
      </div>
    </>
  );
}
