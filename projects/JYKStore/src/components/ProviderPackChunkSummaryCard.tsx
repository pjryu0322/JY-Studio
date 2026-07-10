"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChunkPipelineSummaryDto } from "@/lib/chunk-pipeline-dto";
import { fetchPackChunks } from "@/lib/chunk-pipeline-api";
import { PROVIDER_SUBMIT_ADMIN_REVIEW_NOTICE } from "@/lib/role-based-ux-copy";

export function ProviderPackChunkSummaryCard({
  packId,
  chunkActionLabel,
  onChunkAction,
}: {
  readonly packId: string;
  readonly chunkActionLabel?: string;
  readonly onChunkAction?: () => void;
}) {
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
    <section className="rounded-2xl border border-store-border bg-slate-50 p-4 text-xs text-slate-800">
      <h2 className="text-sm font-bold text-slate-900">관리자 검토 예정 항목</h2>
      <p className="mt-1 font-semibold text-slate-700">Chunk 상태</p>
      <ul className="mt-2 space-y-1 text-sm">
        <li className="flex justify-between">
          <span className="text-store-muted">현재 활성 Chunk</span>
          <span className="font-semibold">{summary.activeChunkCount}개</span>
        </li>
        <li className="flex justify-between">
          <span className="text-store-muted">검수 전 비활성 Chunk</span>
          <span className="font-semibold">{summary.inactiveChunkCount}개</span>
        </li>
      </ul>
      <p className="mt-3 leading-relaxed text-store-muted">
        검수 제출 전에는 Chunk가 일반 카탈로그와 Context API에 공개되지 않습니다.{" "}
        {PROVIDER_SUBMIT_ADMIN_REVIEW_NOTICE}
      </p>
      {onChunkAction && chunkActionLabel ? (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
          <p className="font-semibold text-blue-950">필요 조치</p>
          <p className="mt-1 text-blue-900">청킹 품질 점검을 실행하세요.</p>
          <button
            type="button"
            onClick={onChunkAction}
            className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-semibold sm:w-auto"
          >
            {chunkActionLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}
