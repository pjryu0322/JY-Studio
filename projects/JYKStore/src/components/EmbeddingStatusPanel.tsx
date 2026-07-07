"use client";

import { useCallback, useEffect, useState } from "react";
import type { EmbeddingRebuildResultDto, PackEmbeddingSummaryDto } from "@/lib/embedding-dto";
import { fetchPackEmbeddingSummary, rebuildPackEmbeddingsApi } from "@/lib/embedding-api";

export function EmbeddingStatusPanel({ packId }: { readonly packId: string }) {
  const [summary, setSummary] = useState<PackEmbeddingSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<EmbeddingRebuildResultDto | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPackEmbeddingSummary(packId);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "embedding 상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onRebuild = async () => {
    setRebuilding(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await rebuildPackEmbeddingsApi(packId, { force });
      setLastResult(result);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "embedding 재생성에 실패했습니다.");
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">Embedding 상태 (P14 foundation)</h3>
      </div>
      <p className="text-xs text-store-muted">
        local-hash embedding으로 chunk vector를 생성합니다. 외부 embedding API 호출이 아니라 개발/foundation
        provider이며, Retrieval API의 hybrid mode에서 사용됩니다.
      </p>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {loading && !summary ? (
        <p className="text-sm text-store-muted">embedding 상태 불러오는 중…</p>
      ) : summary ? (
        <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
          <div>provider: {summary.provider}</div>
          <div>model: {summary.model}</div>
          <div>dimension: {summary.dimension}</div>
          <div>활성 chunk: {summary.activeChunkCount}</div>
          <div>embedding 있음: {summary.embeddedChunkCount}</div>
          <div>미생성: {summary.missingEmbeddingCount}</div>
          <div>stale: {summary.staleEmbeddingCount}</div>
        </dl>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={force}
          onChange={(e) => setForce(e.target.checked)}
          className="h-4 w-4"
        />
        force rebuild (contentHash 무시하고 전체 재생성)
      </label>

      <button
        type="button"
        onClick={() => void onRebuild()}
        disabled={rebuilding}
        className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
      >
        {rebuilding ? "재생성 중…" : "embedding 재생성"}
      </button>

      {lastResult ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
          처리 {lastResult.processedCount} · 생성 {lastResult.createdCount} · 갱신{" "}
          {lastResult.updatedCount} · 생략 {lastResult.skippedCount}
        </p>
      ) : null}
    </section>
  );
}
