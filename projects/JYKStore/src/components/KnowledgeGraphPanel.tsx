"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  KnowledgeGraphRebuildResultDto,
  KnowledgeGraphSummaryDto,
} from "@/lib/knowledge-graph-dto";
import { fetchKnowledgeGraphSummary, rebuildKnowledgeGraphApi } from "@/lib/knowledge-graph-api";

function CountList({ title, counts }: { readonly title: string; readonly counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-store-muted">없음</p>
      ) : (
        <ul className="space-y-1">
          {entries.map(([key, value]) => (
            <li key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-xs">
              <span className="font-mono text-slate-700">{key}</span>
              <span className="font-bold text-slate-900">{value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function KnowledgeGraphPanel({ packId }: { readonly packId: string }) {
  const [summary, setSummary] = useState<KnowledgeGraphSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<KnowledgeGraphRebuildResultDto | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchKnowledgeGraphSummary(packId);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "graph 상태를 불러오지 못했습니다.");
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
      const result = await rebuildKnowledgeGraphApi(packId);
      setLastResult(result);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "graph 재생성에 실패했습니다.");
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h3 className="text-sm font-bold text-slate-900">Knowledge Graph (P15 foundation)</h3>
      <p className="text-xs text-store-muted">
        기존 pack/version/source/chunk/tag/metadata를 deterministic 방식으로 node/edge 그래프로 재구성합니다.
        외부 AI/LLM 호출 없이 DB 데이터만 사용하며, 답변 생성은 하지 않습니다.
      </p>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {loading && !summary ? (
        <p className="text-sm text-store-muted">graph 상태 불러오는 중…</p>
      ) : summary ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
            <div>versionId: {summary.versionId ? summary.versionId.slice(0, 8) + "…" : "없음"}</div>
            <div>node 수: {summary.nodeCount}</div>
            <div>edge 수: {summary.edgeCount}</div>
          </dl>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CountList title="node type별" counts={summary.nodeTypeCounts} />
            <CountList title="edge type별" counts={summary.edgeTypeCounts} />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void onRebuild()}
        disabled={rebuilding}
        className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
      >
        {rebuilding ? "graph 재생성 중…" : "graph 재생성"}
      </button>

      {lastResult ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
          node {lastResult.nodeCount} · edge {lastResult.edgeCount} · 삭제 node{" "}
          {lastResult.deletedNodeCount} · 삭제 edge {lastResult.deletedEdgeCount}
        </p>
      ) : null}
    </section>
  );
}
