"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchProviderKnowledgePipelineApi,
  startProviderKnowledgePipelineApi,
  type DoclingKnowledgePipelineStatusDto,
} from "@/lib/provider-center-api";

function statusLabel(status: string): string {
  switch (status) {
    case "PASS":
      return "완료";
    case "WARNING":
      return "보완 권장";
    case "RUNNING":
      return "진행 중";
    case "FAIL":
      return "실패";
    case "STALE":
      return "다시 생성 필요";
    case "PENDING":
      return "대기";
    default:
      return status;
  }
}

function statusClass(status: string): string {
  if (status === "PASS") return "text-emerald-700";
  if (status === "WARNING") return "text-amber-700";
  if (status === "RUNNING") return "text-sky-700";
  if (status === "FAIL" || status === "STALE") return "text-rose-700";
  return "text-slate-600";
}

export function ProviderKnowledgeGenerationTab({
  packId,
  editable,
  onGoToDistribution,
  onStatusChange,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly onGoToDistribution?: () => void;
  readonly onStatusChange?: (status: DoclingKnowledgePipelineStatusDto) => void;
}) {
  const [status, setStatus] = useState<DoclingKnowledgePipelineStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchProviderKnowledgePipelineApi(packId);
      setStatus(data);
      onStatusChange?.(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId, onStatusChange]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!status || status.runStatus !== "RUNNING") return;
    const timer = window.setInterval(() => {
      void load();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [status?.runStatus, load]);

  async function handleStart(forceRestart = false) {
    setStarting(true);
    setError(null);
    try {
      await startProviderKnowledgePipelineApi(packId, { forceRestart });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "지식 데이터 생성을 시작하지 못했습니다.");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-store-muted">지식 데이터 생성 상태를 불러오는 중…</p>;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div>
        <h2 className="text-base font-bold text-slate-900">지식 데이터 생성</h2>
        <p className="mt-1 text-sm text-store-muted">
          등록한 문서를 AI가 검색하고 활용할 수 있는 지식 데이터로 변환합니다. 문서 구조, 지식
          단위, 검색 데이터와 검색 결과를 순서대로 확인합니다.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {!status?.providerConfirmed ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {status?.lockReason ??
            "자료 등록에서 대표 샘플 확인을 완료해야 이 단계를 시작할 수 있습니다."}
        </p>
      ) : null}

      <ol className="space-y-2">
        {(status?.stages ?? []).map((stage) => (
          <li
            key={stage.id}
            className="rounded-xl border border-store-border bg-slate-50 px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{stage.label}</p>
                <p className="text-xs text-store-muted">{stage.description}</p>
              </div>
              <span className={`text-xs font-bold ${statusClass(stage.status)}`}>
                {statusLabel(stage.status)}
              </span>
            </div>
            {stage.message ? (
              <p className="mt-1 text-xs text-slate-700">{stage.message}</p>
            ) : null}
            {stage.nextAction ? (
              <p className="mt-1 text-xs text-amber-800">다음 행동: {stage.nextAction}</p>
            ) : null}
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-store-accent"
              onClick={() => setExpanded(expanded === stage.id ? null : stage.id)}
            >
              {expanded === stage.id ? "상세 접기" : "상세 보기"}
            </button>
            {expanded === stage.id ? (
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white p-2 text-[11px] text-slate-600">
                {JSON.stringify(
                  {
                    startedAt: stage.startedAt,
                    finishedAt: stage.finishedAt,
                    details: stage.details,
                  },
                  null,
                  2,
                )}
              </pre>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        {editable && status?.canStart && status.runStatus !== "RUNNING" ? (
          <button
            type="button"
            disabled={starting}
            onClick={() => void handleStart(false)}
            className="rounded-xl bg-store-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {starting ? "시작 중…" : "지식 데이터 생성 시작"}
          </button>
        ) : null}
        {editable && status?.canRetry && status.runStatus !== "RUNNING" ? (
          <button
            type="button"
            disabled={starting}
            onClick={() => void handleStart(true)}
            className="rounded-xl border border-store-border bg-white px-4 py-2 text-sm font-bold text-slate-800 disabled:opacity-60"
          >
            {starting ? "재시작 중…" : "다시 생성"}
          </button>
        ) : null}
        {status?.passed ? (
          <button
            type="button"
            onClick={() => onGoToDistribution?.()}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
          >
            유통정보 입력
          </button>
        ) : null}
      </div>

      {status?.passed ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          지식 데이터 생성 완료. 유통정보를 입력한 뒤 검수요청을 진행할 수 있습니다.
        </p>
      ) : null}
    </section>
  );
}
