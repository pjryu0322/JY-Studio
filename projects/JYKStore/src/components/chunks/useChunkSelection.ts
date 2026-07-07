import { useCallback, useState } from "react";

export function useChunkSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((chunkId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  }, []);

  const selectAll = useCallback((chunkIds: string[]) => {
    setSelectedIds(new Set(chunkIds));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return {
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    selectedCount: selectedIds.size,
    selectedIdList: Array.from(selectedIds),
  };
}
