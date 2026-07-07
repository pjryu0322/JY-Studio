import { useCallback, useEffect, useState } from "react";
import type {
  BulkMetadataMode,
  PackChunksListResponse,
} from "@/lib/chunk-pipeline-dto";
import {
  bulkUpdateChunkMetadataApi,
  createPackChunkApi,
  deactivatePackChunkApi,
  fetchPackChunks,
  generateChunksFromDocumentApi,
  updatePackChunkApi,
} from "@/lib/chunk-pipeline-api";
import { parseMetadataText, parseTagsText } from "./chunk-ui-utils";
import type { ChunkEditFormValues } from "./ChunkEditForm";

export type ManualChunkInput = {
  versionId: string;
  title: string;
  content: string;
  section: string;
  metadataText: string;
};

export function useChunkManager(packId: string) {
  const [data, setData] = useState<PackChunksListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versionId, setVersionId] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPackChunks(packId);
      setData(res);
      setVersionId((current) => current || res.versions[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "청크 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const generateChunks = useCallback(
    async (
      sourceDocumentId: string,
      options: { maxChunkChars: number; overwriteExisting: boolean },
    ): Promise<void> => {
      setGeneratingId(sourceDocumentId);
      setError(null);
      try {
        await generateChunksFromDocumentApi(packId, sourceDocumentId, {
          maxChunkChars: options.maxChunkChars,
          overwriteExisting: options.overwriteExisting,
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "청크 생성에 실패했습니다.");
      } finally {
        setGeneratingId(null);
      }
    },
    [packId, refresh],
  );

  const createChunk = useCallback(
    async (input: ManualChunkInput): Promise<boolean> => {
      if (!input.versionId) return false;
      setError(null);

      const metadataResult = parseMetadataText(input.metadataText);
      if (!metadataResult.ok) {
        setError(metadataResult.error);
        return false;
      }

      setCreating(true);
      try {
        await createPackChunkApi(packId, {
          versionId: input.versionId,
          title: input.title,
          content: input.content,
          section: input.section.trim() || undefined,
          metadata: metadataResult.metadata,
          chunkType: "MANUAL",
        });
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "청크를 만들지 못했습니다.");
        return false;
      } finally {
        setCreating(false);
      }
    },
    [packId, refresh],
  );

  const updateChunk = useCallback(
    async (chunkId: string, values: ChunkEditFormValues): Promise<boolean> => {
      setError(null);

      const metadataResult = parseMetadataText(values.metadataText);
      if (!metadataResult.ok) {
        setError(metadataResult.error);
        return false;
      }

      try {
        const parsedSortOrder = Number(values.sortOrder);
        await updatePackChunkApi(packId, chunkId, {
          title: values.title,
          content: values.content,
          section: values.section.trim() || null,
          tags: parseTagsText(values.tagsText),
          metadata: metadataResult.metadata,
          sortOrder: Number.isFinite(parsedSortOrder) ? parsedSortOrder : undefined,
          isActive: values.isActive,
        });
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "수정에 실패했습니다.");
        return false;
      }
    },
    [packId, refresh],
  );

  const deactivateChunk = useCallback(
    async (chunkId: string): Promise<void> => {
      if (!window.confirm("이 청크를 비활성화할까요? Context API에서 제외됩니다.")) return;
      setError(null);
      try {
        await deactivatePackChunkApi(packId, chunkId);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "비활성화에 실패했습니다.");
      }
    },
    [packId, refresh],
  );

  const applyBulkMetadata = useCallback(
    async (input: {
      chunkIds: string[];
      mode: BulkMetadataMode;
      metadataText: string;
    }): Promise<boolean> => {
      if (input.chunkIds.length === 0) {
        setError("선택된 chunk가 없습니다.");
        return false;
      }
      setError(null);

      let metadata: Record<string, unknown> | null = null;
      if (input.mode !== "clear") {
        const parsed = parseMetadataText(input.metadataText);
        if (!parsed.ok) {
          setError(parsed.error);
          return false;
        }
        metadata = parsed.metadata;
      }

      setBulkApplying(true);
      try {
        await bulkUpdateChunkMetadataApi(packId, {
          chunkIds: input.chunkIds,
          mode: input.mode,
          metadata,
        });
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "일괄 적용에 실패했습니다.");
        return false;
      } finally {
        setBulkApplying(false);
      }
    },
    [packId, refresh],
  );

  return {
    data,
    loading,
    error,
    setError,
    versionId,
    setVersionId,
    generatingId,
    creating,
    bulkApplying,
    refresh,
    generateChunks,
    createChunk,
    updateChunk,
    deactivateChunk,
    applyBulkMetadata,
  };
}
