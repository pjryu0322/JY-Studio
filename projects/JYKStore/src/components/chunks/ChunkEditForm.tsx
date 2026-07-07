"use client";

import { useState } from "react";
import type { KnowledgeChunkDto } from "@/lib/chunk-pipeline-dto";
import { METADATA_PLACEHOLDER } from "./chunk-ui-utils";

export type ChunkEditFormValues = {
  title: string;
  content: string;
  section: string;
  tagsText: string;
  metadataText: string;
  sortOrder: string;
  isActive: boolean;
};

type ChunkEditFormProps = {
  chunk: KnowledgeChunkDto;
  onSave: (chunkId: string, values: ChunkEditFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function ChunkEditForm({ chunk, onSave, onCancel }: ChunkEditFormProps) {
  const [editTitle, setEditTitle] = useState(chunk.title);
  const [editContent, setEditContent] = useState(chunk.content);
  const [editSection, setEditSection] = useState(chunk.section ?? "");
  const [editTagsText, setEditTagsText] = useState(chunk.tags.join(", "));
  const [editMetadataText, setEditMetadataText] = useState(
    chunk.metadata ? JSON.stringify(chunk.metadata, null, 2) : "",
  );
  const [editSortOrder, setEditSortOrder] = useState(String(chunk.sortOrder));
  const [editIsActive, setEditIsActive] = useState(chunk.isActive);

  return (
    <div className="space-y-2">
      <input
        value={editTitle}
        onChange={(e) => setEditTitle(e.target.value)}
        className="min-h-[44px] w-full rounded-lg border border-store-border px-2 text-sm"
      />
      <textarea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-store-border px-2 py-1 text-sm"
      />
      <input
        value={editSection}
        onChange={(e) => setEditSection(e.target.value)}
        placeholder="section"
        className="min-h-[44px] w-full rounded-lg border border-store-border px-2 text-sm"
      />
      <input
        value={editTagsText}
        onChange={(e) => setEditTagsText(e.target.value)}
        placeholder="tags, comma-separated"
        className="min-h-[44px] w-full rounded-lg border border-store-border px-2 text-sm"
      />
      <textarea
        value={editMetadataText}
        onChange={(e) => setEditMetadataText(e.target.value)}
        placeholder={METADATA_PLACEHOLDER}
        rows={4}
        className="w-full rounded-lg border border-store-border px-2 py-1 font-mono text-xs"
      />
      <p className="text-[11px] text-store-muted">metadata(JSON): 비우면 metadata가 제거됩니다.</p>
      <input
        value={editSortOrder}
        onChange={(e) => setEditSortOrder(e.target.value)}
        placeholder="sortOrder"
        inputMode="numeric"
        className="min-h-[44px] w-full rounded-lg border border-store-border px-2 text-sm"
      />
      <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={editIsActive}
          onChange={(e) => setEditIsActive(e.target.checked)}
          className="h-4 w-4"
        />
        활성 chunk
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            void onSave(chunk.id, {
              title: editTitle,
              content: editContent,
              section: editSection,
              tagsText: editTagsText,
              metadataText: editMetadataText,
              sortOrder: editSortOrder,
              isActive: editIsActive,
            })
          }
          className="min-h-[44px] flex-1 rounded-lg bg-store-accent text-sm font-bold text-white"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] flex-1 rounded-lg border border-store-border text-sm"
        >
          취소
        </button>
      </div>
    </div>
  );
}
