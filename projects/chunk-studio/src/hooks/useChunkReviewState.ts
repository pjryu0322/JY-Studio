"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChunkDTO, Job, JobDetailDTO } from "@/types/job";
import type { RagRefinementPayload } from "@/lib/analysis/ragExportOptimizer";
import { analyzeChunkQualityBatch } from "@/lib/analysis/chunkQualityAnalyzer";
import { highlightChunkInPreview } from "@/lib/analysis/chunkMappingService";
import {
  type ChunkFilter,
  findMergeTarget,
  processingMessage,
  resolveUiStatus,
  toStatusGroup,
} from "@/components/workspace/chunk-review/utils";

interface Params {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
}

export function useChunkReviewState({ selectedJob, detail, loading, error }: Params) {
  const statusGroup = toStatusGroup(selectedJob?.status);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ChunkFilter>("all");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const [editedLabels, setEditedLabels] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [modifiedChunkIds, setModifiedChunkIds] = useState<Set<string>>(new Set());
  const [excludedChunkIds, setExcludedChunkIds] = useState<Set<string>>(new Set());
  const [mergePairs, setMergePairs] = useState<Record<string, string>>({});

  useEffect(() => {
    const onSelectedSection = (e: Event) => {
      const custom = e as CustomEvent<string>;
      setSectionFilter(custom.detail || null);
    };
    window.addEventListener("chunkstudio:selected-section", onSelectedSection as EventListener);
    return () =>
      window.removeEventListener("chunkstudio:selected-section", onSelectedSection as EventListener);
  }, []);

  useEffect(() => {
    const onSelectedChunk = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (typeof custom.detail === "string") setSelectedChunkId(custom.detail);
    };
    window.addEventListener("chunkstudio:selected-chunk", onSelectedChunk as EventListener);
    return () =>
      window.removeEventListener("chunkstudio:selected-chunk", onSelectedChunk as EventListener);
  }, []);

  useEffect(() => {
    if (!selectedJob) return;
    const payload: RagRefinementPayload & { jobId: string } = {
      jobId: selectedJob.id,
      editedLabels,
      reviewNotes,
      excludedChunkIds: Array.from(excludedChunkIds),
      mergePairs,
      modifiedChunkIds: Array.from(modifiedChunkIds),
    };
    window.dispatchEvent(new CustomEvent("chunkstudio:refinements-changed", { detail: payload }));
  }, [editedLabels, excludedChunkIds, mergePairs, modifiedChunkIds, reviewNotes, selectedJob]);

  const indexedChunks = useMemo(
    () =>
      (detail?.chunks ?? []).map((chunk, index) => ({
        chunk,
        index,
        quality: analyzeChunkQualityBatch([chunk])[0],
      })),
    [detail?.chunks]
  );

  const filteredChunks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return indexedChunks
      .filter(({ chunk, quality }) => {
        const status = resolveUiStatus(chunk, quality.status, modifiedChunkIds);
        const matchSearch = !q
          ? true
          : chunk.text.toLowerCase().includes(q) ||
            chunk.meta.chunkId.toLowerCase().includes(q) ||
            chunk.meta.sectionPath.join(" > ").toLowerCase().includes(q) ||
            (chunk.meta.sectionTitle ?? "").toLowerCase().includes(q);
        const matchFilter =
          filter === "all"
            ? true
            : filter === "needs-review"
              ? status === "검토 필요"
              : filter === "edited"
                ? status === "수정됨"
                : filter === "noise"
                  ? status === "노이즈 의심"
                  : filter === "long"
                    ? status === "긴 청크"
                    : status === "짧은 청크";
        const chunkSection = chunk.meta.sectionPath.join(" > ") || "Unsectioned";
        const matchSection = !sectionFilter || chunkSection === sectionFilter;
        return matchSearch && matchFilter && matchSection;
      })
      .map(({ chunk, index, quality }) => ({
        chunk,
        index,
        status: resolveUiStatus(chunk, quality.status, modifiedChunkIds),
      }));
  }, [filter, indexedChunks, modifiedChunkIds, search, sectionFilter]);

  const selectedChunk = useMemo(() => {
    const resolvedId = selectedChunkId ?? detail?.chunks?.[0]?.meta.chunkId ?? null;
    return (
      filteredChunks.find((entry) => entry.chunk.meta.chunkId === resolvedId)?.chunk ??
      filteredChunks[0]?.chunk ??
      null
    );
  }, [detail?.chunks, filteredChunks, selectedChunkId]);

  const selectedStatus = useMemo(() => {
    if (!selectedChunk) return null;
    const quality = analyzeChunkQualityBatch([selectedChunk])[0];
    return resolveUiStatus(selectedChunk, quality.status, modifiedChunkIds);
  }, [modifiedChunkIds, selectedChunk]);

  const suggestedMergeTarget = useMemo(
    () => (selectedChunk && detail?.chunks ? findMergeTarget(selectedChunk, detail.chunks) : null),
    [detail, selectedChunk]
  );

  const markModified = (chunkId: string) => {
    setModifiedChunkIds((prev) => {
      const next = new Set(prev);
      next.add(chunkId);
      return next;
    });
  };

  const selectChunk = (chunk: ChunkDTO) => {
    setSelectedChunkId(chunk.meta.chunkId);
    window.dispatchEvent(
      new CustomEvent("chunkstudio:selected-chunk", { detail: chunk.meta.chunkId })
    );
    highlightChunkInPreview(chunk);
  };

  const emptyMessage = detail?.chunks?.length
    ? "조건에 맞는 청크가 없습니다."
    : loading || statusGroup === "processing"
      ? processingMessage(selectedJob?.status)
      : statusGroup === "failed"
        ? "문서 분석에 실패했습니다."
        : error ?? "청크가 아직 생성되지 않았습니다.";

  const selectedEmptyMessage =
    loading || statusGroup === "processing"
      ? processingMessage(selectedJob?.status)
      : error ?? null;

  return {
    filter,
    setFilter,
    search,
    setSearch,
    sectionFilter,
    setSectionFilter,
    filteredChunks,
    selectedChunk,
    selectedStatus,
    suggestedMergeTarget,
    editedLabels,
    setEditedLabels,
    reviewNotes,
    setReviewNotes,
    modifiedChunkIds,
    excludedChunkIds,
    mergePairs,
    setMergePairs,
    setExcludedChunkIds,
    markModified,
    selectChunk,
    detail,
    emptyMessage,
    selectedEmptyMessage,
  };
}
