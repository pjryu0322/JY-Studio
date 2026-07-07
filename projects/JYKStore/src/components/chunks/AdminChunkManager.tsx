"use client";

import { useMemo, useState } from "react";
import type { BulkMetadataMode } from "@/lib/chunk-pipeline-dto";
import { EmbeddingStatusPanel } from "@/components/EmbeddingStatusPanel";
import { includesNormalized, tokenizeSearchQuery } from "@/lib/search-utils";
import { ChunkBulkMetadataPanel } from "./ChunkBulkMetadataPanel";
import type { ChunkEditFormValues } from "./ChunkEditForm";
import { ChunkList } from "./ChunkList";
import { ChunkSearchBar } from "./ChunkSearchBar";
import { ChunkSourceDocumentList } from "./ChunkSourceDocumentList";
import { ChunkSummaryCards } from "./ChunkSummaryCards";
import { ManualChunkForm } from "./ManualChunkForm";
import { useChunkManager } from "./useChunkManager";
import { useChunkSelection } from "./useChunkSelection";

export function AdminChunkManager({ packId }: { readonly packId: string }) {
  const manager = useChunkManager(packId);
  const selection = useChunkSelection();

  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [maxChunkChars, setMaxChunkChars] = useState(1200);
  const [chunkQuery, setChunkQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const chunkQueryTokens = tokenizeSearchQuery(chunkQuery);
  const visibleChunks = useMemo(() => {
    const all = manager.data?.chunks ?? [];
    if (chunkQueryTokens.length === 0) return all;
    return all.filter((chunk) => {
      const fields = [chunk.title, chunk.content, chunk.section, chunk.chunkType, ...chunk.tags];
      return chunkQueryTokens.some((token) =>
        fields.some((field) => includesNormalized(field, token)),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager.data?.chunks, chunkQuery]);

  if (manager.loading && !manager.data) {
    return <p className="text-sm text-store-muted">청크 정보 불러오는 중…</p>;
  }

  const summary = manager.data?.summary;

  const handleSaveEdit = async (chunkId: string, values: ChunkEditFormValues) => {
    const ok = await manager.updateChunk(chunkId, values);
    if (ok) setEditingId(null);
  };

  const handleApplyBulk = async (mode: BulkMetadataMode, metadataText: string) => {
    const ok = await manager.applyBulkMetadata({
      chunkIds: selection.selectedIdList,
      mode,
      metadataText,
    });
    if (ok) selection.clearSelection();
  };

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h3 className="text-sm font-bold text-slate-900">Chunk 관리</h3>
      <p className="text-xs text-store-muted">
        승인 전 Context API에 노출될 활성 chunk를 생성·검수합니다. 비활성 chunk는 삭제하지 않고 제외합니다.
      </p>

      {manager.error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          {manager.error}
        </div>
      ) : null}

      {summary ? <ChunkSummaryCards summary={summary} /> : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={overwriteExisting}
            onChange={(e) => setOverwriteExisting(e.target.checked)}
          />
          overwriteExisting
        </label>
        <label className="flex items-center gap-2">
          maxChunkChars
          <select
            value={maxChunkChars}
            onChange={(e) => setMaxChunkChars(Number(e.target.value))}
            className="rounded-lg border border-store-border px-2 py-1"
          >
            {[800, 1200, 1600].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ChunkSourceDocumentList
        sourceDocuments={manager.data?.sourceDocuments ?? []}
        generatingId={manager.generatingId}
        onGenerate={(sourceDocumentId) =>
          manager.generateChunks(sourceDocumentId, { maxChunkChars, overwriteExisting })
        }
      />

      <ManualChunkForm
        versions={manager.data?.versions ?? []}
        versionId={manager.versionId}
        onVersionChange={manager.setVersionId}
        creating={manager.creating}
        onCreate={manager.createChunk}
      />

      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-800">chunk 목록</p>
        <ChunkSearchBar
          value={chunkQuery}
          onChange={setChunkQuery}
          tokenCount={chunkQueryTokens.length}
          visibleCount={visibleChunks.length}
        />

        <ChunkBulkMetadataPanel
          selectedCount={selection.selectedCount}
          bulkApplying={manager.bulkApplying}
          onSelectAllVisible={() => selection.selectAll(visibleChunks.map((chunk) => chunk.id))}
          onClearSelection={selection.clearSelection}
          onApply={handleApplyBulk}
        />

        <ChunkList
          chunks={visibleChunks}
          hasAnyChunks={Boolean(manager.data?.chunks.length)}
          isSelected={(chunkId) => selection.selectedIds.has(chunkId)}
          onToggleSelect={selection.toggleSelect}
          editingId={editingId}
          onStartEdit={setEditingId}
          onCancelEdit={() => setEditingId(null)}
          onSaveEdit={handleSaveEdit}
          onDeactivate={manager.deactivateChunk}
        />
      </div>

      <EmbeddingStatusPanel packId={packId} />
    </section>
  );
}
