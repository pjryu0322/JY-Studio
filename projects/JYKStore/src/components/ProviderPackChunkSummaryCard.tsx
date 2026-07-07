"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChunkPipelineSummaryDto } from "@/lib/chunk-pipeline-dto";
import { fetchPackChunks } from "@/lib/chunk-pipeline-api";

export function ProviderPackChunkSummaryCard({ packId }: { readonly packId: string }) {
  const [summary, setSummary] = useState<ChunkPipelineSummaryDto | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchPackChunks(packId);
      setSummary(data.summary);
    } catch {
      setSummary(null);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!summary) return null;

  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">Chunk 상태</h2>
      <p className="mt-1 text-xs text-store-muted">
        검수·공개 전 Admin Console에서 chunk 품질을 확인합니다. 제공자는 chunk를 직접 편집하지 않습니다.
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        <li className="flex justify-between">
          <span className="text-store-muted">활성 chunk</span>
          <span className="font-semibold">{summary.activeChunkCount}개</span>
        </li>
        <li className="flex justify-between">
          <span className="text-store-muted">비활성 chunk</span>
          <span className="font-semibold">{summary.inactiveChunkCount}개</span>
        </li>
      </ul>
    </section>
  );
}
