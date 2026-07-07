"use client";

import { FormEvent, useState } from "react";
import type { PackChunksListResponse } from "@/lib/chunk-pipeline-dto";
import { METADATA_PLACEHOLDER } from "./chunk-ui-utils";
import type { ManualChunkInput } from "./useChunkManager";

type ManualChunkFormProps = {
  versions: PackChunksListResponse["versions"];
  versionId: string;
  onVersionChange: (versionId: string) => void;
  creating: boolean;
  onCreate: (input: ManualChunkInput) => Promise<boolean>;
};

export function ManualChunkForm({
  versions,
  versionId,
  onVersionChange,
  creating,
  onCreate,
}: ManualChunkFormProps) {
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualSection, setManualSection] = useState("");
  const [manualMetadataText, setManualMetadataText] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!versionId) return;
    const ok = await onCreate({
      versionId,
      title: manualTitle,
      content: manualContent,
      section: manualSection,
      metadataText: manualMetadataText,
    });
    if (ok) {
      setManualTitle("");
      setManualContent("");
      setManualSection("");
      setManualMetadataText("");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-xl border border-dashed border-store-border p-3">
      <p className="text-xs font-bold text-slate-800">수동 chunk 생성</p>
      <select
        value={versionId}
        onChange={(e) => onVersionChange(e.target.value)}
        className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
      >
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            v{v.version}
          </option>
        ))}
      </select>
      <input
        value={manualTitle}
        onChange={(e) => setManualTitle(e.target.value)}
        placeholder="제목"
        className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        required
      />
      <input
        value={manualSection}
        onChange={(e) => setManualSection(e.target.value)}
        placeholder="section (선택)"
        className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
      />
      <textarea
        value={manualContent}
        onChange={(e) => setManualContent(e.target.value)}
        placeholder="내용"
        rows={4}
        className="w-full rounded-xl border border-store-border px-3 py-2 text-sm"
        required
      />
      <textarea
        value={manualMetadataText}
        onChange={(e) => setManualMetadataText(e.target.value)}
        placeholder={METADATA_PLACEHOLDER}
        rows={4}
        className="w-full rounded-xl border border-store-border px-3 py-2 font-mono text-xs"
      />
      <p className="text-[11px] text-store-muted">
        metadata(JSON, 선택): 허용된 key만 저장됩니다. Retrieval API filter의 AND 조건으로 사용됩니다.
      </p>
      <button
        type="submit"
        disabled={creating}
        className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
      >
        {creating ? "생성 중…" : "수동 chunk 추가"}
      </button>
    </form>
  );
}
