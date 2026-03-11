"use client";

import type { Job, JobDetailDTO } from "@/types/job";
import { suggestSplitPoints } from "@/lib/analysis/chunkBoundaryInspector";
import { useChunkReviewState } from "@/hooks/useChunkReviewState";
import ChunkFilterBar from "./ChunkFilterBar";
import ChunkList from "./ChunkList";
import SelectedChunkDetail from "./SelectedChunkDetail";
import ChunkRefinementActions from "./ChunkRefinementActions";
import styles from "./chunkReview.module.css";

interface ChunkReviewContentProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
}

export default function ChunkReviewContent({
  selectedJob,
  detail,
  loading,
  error,
}: ChunkReviewContentProps) {
  const state = useChunkReviewState({ selectedJob, detail, loading, error });

  return (
    <div style={{ padding: 16, height: "100%", boxSizing: "border-box" }}>
      <section className={styles.card}>
        <strong className={styles.cardTitle}>A. Chunk List</strong>
        <ChunkFilterBar
          search={state.search}
          filter={state.filter}
          sectionFilter={state.sectionFilter}
          onChangeSearch={state.setSearch}
          onChangeFilter={state.setFilter}
          onClearSectionFilter={() => state.setSectionFilter(null)}
        />
        <ChunkList
          items={state.filteredChunks}
          selectedChunkId={state.selectedChunk?.meta.chunkId ?? null}
          emptyMessage={state.emptyMessage}
          onSelectChunk={state.selectChunk}
        />
      </section>

      <SelectedChunkDetail
        chunk={state.selectedChunk}
        status={state.selectedStatus}
        mergeTarget={state.suggestedMergeTarget}
        loadingMessage={state.selectedEmptyMessage}
        onJumpToPdf={() => state.selectedChunk && state.selectChunk(state.selectedChunk)}
        onApplyRecommendedMerge={() => {
          if (!state.selectedChunk || !state.suggestedMergeTarget) return;
          state.setMergePairs((prev) => ({
            ...prev,
            [state.selectedChunk!.meta.chunkId]: state.suggestedMergeTarget!.meta.chunkId,
          }));
          state.markModified(state.selectedChunk.meta.chunkId);
          state.markModified(state.suggestedMergeTarget.meta.chunkId);
        }}
      />

      <ChunkRefinementActions
        canEdit={Boolean(state.selectedChunk)}
        labelValue={
          state.selectedChunk
            ? state.editedLabels[state.selectedChunk.meta.chunkId] ??
              state.selectedChunk.meta.sectionTitle ??
              ""
            : ""
        }
        noteValue={state.selectedChunk ? state.reviewNotes[state.selectedChunk.meta.chunkId] ?? "" : ""}
        modifiedStateText={
          state.selectedChunk
            ? `수정 상태: ${state.modifiedChunkIds.has(state.selectedChunk.meta.chunkId) ? "수정됨" : "원본"} / 노이즈 제외: ${
                state.excludedChunkIds.has(state.selectedChunk.meta.chunkId) ? "예" : "아니오"
              } / merge 대상: ${state.mergePairs[state.selectedChunk.meta.chunkId] ?? "-"}`
            : "-"
        }
        onMerge={() => {
          if (!state.selectedChunk) return;
          const currentIndex =
            state.detail?.chunks.findIndex(
              (chunk) => chunk.meta.chunkId === state.selectedChunk!.meta.chunkId
            ) ?? -1;
          const nextChunk = currentIndex >= 0 ? state.detail?.chunks[currentIndex + 1] : null;
          if (!nextChunk) return;
          state.setMergePairs((prev) => ({
            ...prev,
            [state.selectedChunk!.meta.chunkId]: nextChunk.meta.chunkId,
          }));
          state.markModified(state.selectedChunk.meta.chunkId);
          state.markModified(nextChunk.meta.chunkId);
        }}
        onSplit={() => {
          if (!state.selectedChunk) return;
          const split = suggestSplitPoints(state.selectedChunk)[0];
          state.markModified(state.selectedChunk.meta.chunkId);
          state.setReviewNotes((prev) => ({
            ...prev,
            [state.selectedChunk!.meta.chunkId]:
              (prev[state.selectedChunk!.meta.chunkId] ?? "") +
              `\n[split] 분할 검토 필요${split ? ` (offset ${split.offset})` : ""}`,
          }));
        }}
        onToggleExclude={() => {
          if (!state.selectedChunk) return;
          state.setExcludedChunkIds((prev) => {
            const next = new Set(prev);
            if (next.has(state.selectedChunk!.meta.chunkId)) next.delete(state.selectedChunk!.meta.chunkId);
            else next.add(state.selectedChunk!.meta.chunkId);
            return next;
          });
          state.markModified(state.selectedChunk.meta.chunkId);
        }}
        onChangeLabel={(value) => {
          if (!state.selectedChunk) return;
          state.setEditedLabels((prev) => ({ ...prev, [state.selectedChunk!.meta.chunkId]: value }));
        }}
        onBlurLabel={() => state.selectedChunk && state.markModified(state.selectedChunk.meta.chunkId)}
        onChangeNote={(value) => {
          if (!state.selectedChunk) return;
          state.setReviewNotes((prev) => ({ ...prev, [state.selectedChunk!.meta.chunkId]: value }));
        }}
        onBlurNote={() => state.selectedChunk && state.markModified(state.selectedChunk.meta.chunkId)}
      />
    </div>
  );
}
