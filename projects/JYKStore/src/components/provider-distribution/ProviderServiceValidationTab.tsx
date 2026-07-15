"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchProviderServiceValidationApi,
  runProviderServiceValidationApi,
  type ServiceValidationStatusDto,
} from "@/lib/provider-center-api";

function statusLabel(status: string): string {
  switch (status) {
    case "NOT_SELECTED":
      return "미선택";
    case "PENDING":
      return "검증 필요";
    case "RUNNING":
      return "검증 중";
    case "PASS":
      return "완료";
    case "FAIL":
      return "실패";
    case "STALE":
      return "다시 검증 필요";
    default:
      return status;
  }
}

function statusClass(status: string): string {
  if (status === "PASS") return "text-emerald-700";
  if (status === "FAIL" || status === "STALE") return "text-rose-700";
  if (status === "RUNNING") return "text-sky-700";
  if (status === "PENDING") return "text-amber-700";
  return "text-slate-600";
}

const CHANNEL_COPY: Record<string, { title: string; hint: string }> = {
  API: {
    title: "Retrieval API 검증",
    hint: "실행 경로: Retrieval API Adapter",
  },
  MCP: {
    title: "MCP 검증",
    hint: "실행 경로: MCP Tool Handler / jykstore_retrieval_query",
  },
  DOWNLOAD: {
    title: "원본문서 다운로드 검증",
    hint: "실행 경로: Object Storage Stream + SHA-256",
  },
};

export function ProviderServiceValidationTab({
  packId,
  editable,
  onGoToReview,
  onStatusChange,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly onGoToReview?: () => void;
  readonly onStatusChange?: (status: ServiceValidationStatusDto) => void;
}) {
  const [status, setStatus] = useState<ServiceValidationStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [runningChannel, setRunningChannel] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchProviderServiceValidationApi(packId);
      setStatus(data);
      onStatusChange?.(data);
      if (!query && data.suggestedQuery) setQuery(data.suggestedQuery);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "서비스 검증 상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId, onStatusChange, query]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [packId]);

  const canRun = Boolean(editable && status?.canRunValidation);

  async function handleRun(channel: "API" | "MCP" | "DOWNLOAD") {
    if (!canRun) return;
    setRunningChannel(channel);
    setError(null);
    try {
      await runProviderServiceValidationApi(packId, {
        channel,
        query: channel === "DOWNLOAD" ? undefined : query,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "검증 실행에 실패했습니다.");
    } finally {
      setRunningChannel(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-store-muted">서비스 검증 상태를 불러오는 중…</p>;
  }

  const selected = status?.channels.filter((c) => c.selected) ?? [];

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div>
        <h2 className="text-base font-bold text-slate-900">서비스 검증</h2>
        <p className="mt-1 text-sm text-store-muted">
          유통정보에서 선택한 제공 방식을 실제 환경과 동일한 조건으로 확인합니다. 선택한 모든
          제공 방식이 통과해야 검수요청을 진행할 수 있습니다.
        </p>
      </div>

      {!status?.canRunValidation ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          검수요청 시점의 검증 결과입니다. 변경하려면 검수요청을 회수해 주세요.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {selected.some((c) => c.channel === "API" || c.channel === "MCP") && canRun ? (
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor="svc-query">
            테스트 질문
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="svc-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {(status?.channels ?? [])
          .filter((c) => c.selected)
          .map((channel) => {
            const copy = CHANNEL_COPY[channel.channel] ?? {
              title: channel.channel,
              hint: "",
            };
            return (
              <div
                key={channel.channel}
                className="rounded-xl border border-store-border bg-slate-50 px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{copy.title}</p>
                    <p className="text-xs text-store-muted">
                      {channel.adapterPath ?? copy.hint}
                    </p>
                  </div>
                  <span className={`text-xs font-bold ${statusClass(channel.status)}`}>
                    {statusLabel(channel.status)}
                    {channel.currentValidity === "STALE" ? " · 무효" : null}
                  </span>
                </div>
                {channel.runId ? (
                  <p className="mt-1 font-mono text-[11px] text-slate-500">Run: {channel.runId}</p>
                ) : null}
                {channel.failureMessage ? (
                  <p className="mt-2 text-xs text-rose-700">{channel.failureMessage}</p>
                ) : null}
                {channel.status === "PASS" || channel.status === "STALE" ? (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-slate-700">
                    {channel.resultCount != null ? <li>결과 수: {channel.resultCount}</li> : null}
                    {channel.latencyMs != null ? <li>응답시간: {channel.latencyMs}ms</li> : null}
                    {channel.pipelineRunId ? (
                      <li className="break-all">Pipeline: {channel.pipelineRunId}</li>
                    ) : null}
                    {channel.indexGenerationId ? (
                      <li className="break-all">Generation: {channel.indexGenerationId}</li>
                    ) : null}
                    {channel.fingerprint ? (
                      <li className="break-all">Fingerprint: {channel.fingerprint}</li>
                    ) : null}
                    {channel.sourceDocumentId ? (
                      <li>출처: {channel.sourceDocumentId}</li>
                    ) : null}
                    {channel.page != null ? <li>페이지: {channel.page}</li> : null}
                    {channel.details && "fileName" in channel.details ? (
                      <li>파일: {String(channel.details.fileName)}</li>
                    ) : null}
                    {channel.details && "toolName" in channel.details ? (
                      <li>Tool: {String(channel.details.toolName)}</li>
                    ) : null}
                  </ul>
                ) : null}
                {canRun ? (
                  <button
                    type="button"
                    disabled={runningChannel === channel.channel}
                    onClick={() =>
                      void handleRun(channel.channel as "API" | "MCP" | "DOWNLOAD")
                    }
                    className="mt-3 min-h-[44px] rounded-xl border border-store-border bg-white px-3 text-sm font-semibold text-slate-800 disabled:opacity-60"
                  >
                    {runningChannel === channel.channel
                      ? "검증 중…"
                      : channel.status === "PASS"
                        ? "다시 검증"
                        : "검증 실행"}
                  </button>
                ) : null}
              </div>
            );
          })}
      </div>

      {selected.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          유통정보에서 제공 방식을 한 개 이상 선택한 뒤 다시 확인해 주세요.
        </p>
      ) : null}

      {status?.allSelectedPassed ? (
        <div className="space-y-2">
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            선택한 모든 제공 방식의 검증이 완료되었습니다. 검수요청을 진행할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => onGoToReview?.()}
            className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
          >
            검수요청으로 이동
          </button>
        </div>
      ) : null}
    </section>
  );
}
