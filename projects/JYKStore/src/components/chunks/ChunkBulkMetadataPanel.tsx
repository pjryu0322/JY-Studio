"use client";

import { useState } from "react";
import type { BulkMetadataMode } from "@/lib/chunk-pipeline-dto";
import { METADATA_PLACEHOLDER } from "./chunk-ui-utils";

type ChunkBulkMetadataPanelProps = {
  selectedCount: number;
  bulkApplying: boolean;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onApply: (mode: BulkMetadataMode, metadataText: string) => void | Promise<void>;
};

export function ChunkBulkMetadataPanel({
  selectedCount,
  bulkApplying,
  onSelectAllVisible,
  onClearSelection,
  onApply,
}: ChunkBulkMetadataPanelProps) {
  const [bulkMode, setBulkMode] = useState<BulkMetadataMode>("merge");
  const [bulkMetadataText, setBulkMetadataText] = useState("");

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-store-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-800">metadata 일괄 편집</p>
        <span className="text-[11px] text-store-muted">선택 {selectedCount}개</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelectAllVisible}
          className="min-h-[36px] rounded-lg border border-store-border px-3 text-xs font-semibold"
        >
          검색 결과 전체 선택
        </button>
        <button
          type="button"
          onClick={onClearSelection}
          className="min-h-[36px] rounded-lg border border-store-border px-3 text-xs font-semibold"
        >
          선택 해제
        </button>
      </div>
      <select
        value={bulkMode}
        onChange={(e) => setBulkMode(e.target.value as BulkMetadataMode)}
        className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
      >
        <option value="merge">merge (기존 metadata에 병합)</option>
        <option value="replace">replace (기존 metadata 교체)</option>
        <option value="clear">clear (metadata 제거)</option>
      </select>
      {bulkMode !== "clear" ? (
        <textarea
          value={bulkMetadataText}
          onChange={(e) => setBulkMetadataText(e.target.value)}
          placeholder={METADATA_PLACEHOLDER}
          rows={4}
          className="w-full rounded-xl border border-store-border px-3 py-2 font-mono text-xs"
        />
      ) : (
        <p className="text-[11px] text-store-muted">선택 chunk의 metadata를 제거합니다.</p>
      )}
      <button
        type="button"
        onClick={() => void onApply(bulkMode, bulkMetadataText)}
        disabled={bulkApplying || selectedCount === 0}
        className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
      >
        {bulkApplying ? "적용 중…" : `선택 ${selectedCount}개에 일괄 적용`}
      </button>
    </div>
  );
}
