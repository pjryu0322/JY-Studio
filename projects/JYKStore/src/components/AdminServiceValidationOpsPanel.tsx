"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type AdminRun = {
  runId: string;
  channel: string;
  historicalStatus: string;
  systemStatus: string;
  currentValidity: string | null;
  providerConfirmationStatus: string | null;
  providerConfirmationId: string | null;
  query: string | null;
  resultCount: number | null;
  latencyMs: number | null;
  testedAt: string | null;
  createdAt: string;
  adapterPath: string;
  pipelineRunId: string | null;
  indexGenerationId: string | null;
  normalizedDocumentId: string | null;
  fingerprint: string | null;
  resultFingerprint: string | null;
  toolName: string | null;
  mcpProtocolVersion: string | null;
  requestId: string | null;
  topChunkId: string | null;
  sourceDocumentId: string | null;
  page: number | null;
  failureCode: string | null;
  failureMessage: string | null;
  testedByUserId: string | null;
  testedByName: string | null;
  confirmedByUserId: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  downloadTestCompleted: boolean;
  downloadTestedAt: string | null;
  downloadTestedByName: string | null;
  downloadTestFileId: string | null;
  invalidationReason: string | null;
  results: Array<{
    rank: number;
    chunkId: string;
    title: string;
    snippet: string;
    score: number;
    sourceDocumentId: string;
    sourceDocumentTitle: string | null;
    pageStart: number | null;
    pageEnd: number | null;
  }>;
};

export function AdminServiceValidationOpsPanel({ packId }: { readonly packId: string }) {
  const [latestByChannel, setLatestByChannel] = useState<AdminRun[]>([]);
  const [history, setHistory] = useState<AdminRun[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [channel, setChannel] = useState("");
  const [systemStatus, setSystemStatus] = useState("");
  const [providerConfirmationStatus, setProviderConfirmationStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("pageSize", "20");
    if (channel) p.set("channel", channel);
    if (systemStatus) p.set("systemStatus", systemStatus);
    if (providerConfirmationStatus) {
      p.set("providerConfirmationStatus", providerConfirmationStatus);
    }
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    return p.toString();
  }, [page, channel, systemStatus, providerConfirmationStatus, dateFrom, dateTo]);

  const resetFilters = () => {
    setChannel("");
    setSystemStatus("");
    setProviderConfirmationStatus("");
    setDateFrom("");
    setDateTo("");
    setDateError(null);
    setPage(1);
  };

  const load = useCallback(async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setDateError("종료일은 시작일 이후여야 합니다.");
      setLoading(false);
      return;
    }
    setDateError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/admin/reviews/${encodeURIComponent(packId)}/service-validation?${query}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || "운영 로그를 불러오지 못했습니다.");
      }
      const data = (await res.json()) as {
        latestByChannel: AdminRun[];
        history: AdminRun[];
        pagination: { totalPages: number; totalCount: number };
      };
      setLatestByChannel(data.latestByChannel ?? []);
      setHistory(data.history ?? []);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setTotalCount(data.pagination?.totalCount ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "운영 로그를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId, query, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div>
        <h2 className="text-sm font-bold text-slate-900">서비스 검증 운영 로그</h2>
        <p className="mt-1 text-xs text-store-muted">조회 전용입니다. 수정·삭제할 수 없습니다.</p>
      </div>

      {loading ? <p className="text-sm text-store-muted">불러오는 중…</p> : null}
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {dateError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dateError}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        {latestByChannel.map((run) => (
          <div key={run.runId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <p className="font-bold text-slate-900">{run.channel}</p>
            <p>시스템 검증: {run.systemStatus}</p>
            <p>제공자 확인: {run.providerConfirmationStatus ?? "—"}</p>
            <p>실행일: {run.testedAt ? new Date(run.testedAt).toLocaleString("ko-KR") : "—"}</p>
            <p>응답시간: {run.latencyMs != null ? `${run.latencyMs}ms` : "—"}</p>
            <p>결과: {run.resultCount ?? "—"}건</p>
            <p>현재 유효성: {run.currentValidity ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <select
          className="min-h-[40px] rounded-lg border border-store-border px-2 text-sm"
          value={channel}
          onChange={(e) => {
            setPage(1);
            setChannel(e.target.value);
          }}
        >
          <option value="">전체 채널</option>
          <option value="API">API</option>
          <option value="MCP">MCP</option>
          <option value="DOWNLOAD">DOWNLOAD</option>
        </select>
        <select
          className="min-h-[40px] rounded-lg border border-store-border px-2 text-sm"
          value={systemStatus}
          onChange={(e) => {
            setPage(1);
            setSystemStatus(e.target.value);
          }}
        >
          <option value="">전체 시스템 상태</option>
          <option value="PASS">PASS</option>
          <option value="FAIL">FAIL</option>
          <option value="STALE">STALE</option>
        </select>
        <select
          className="min-h-[40px] rounded-lg border border-store-border px-2 text-sm"
          value={providerConfirmationStatus}
          onChange={(e) => {
            setPage(1);
            setProviderConfirmationStatus(e.target.value);
          }}
        >
          <option value="">전체 제공자 확인</option>
          <option value="NOT_REVIEWED">미확인</option>
          <option value="CONFIRMED">확인 완료</option>
          <option value="REJECTED">반려</option>
          <option value="STALE">확인 무효</option>
        </select>
        <label className="flex min-h-[40px] flex-col gap-1 text-xs text-store-muted">
          시작일
          <input
            type="date"
            className="min-h-[40px] rounded-lg border border-store-border px-2 text-sm text-slate-900"
            value={dateFrom}
            onChange={(e) => {
              setPage(1);
              setDateFrom(e.target.value);
            }}
          />
        </label>
        <label className="flex min-h-[40px] flex-col gap-1 text-xs text-store-muted">
          종료일
          <input
            type="date"
            className="min-h-[40px] rounded-lg border border-store-border px-2 text-sm text-slate-900"
            value={dateTo}
            onChange={(e) => {
              setPage(1);
              setDateTo(e.target.value);
            }}
          />
        </label>
        <button
          type="button"
          className="min-h-[40px] rounded-lg border border-store-border px-3 text-sm font-semibold text-slate-800"
          onClick={resetFilters}
        >
          필터 초기화
        </button>
      </div>

      <p className="text-xs text-store-muted">총 {totalCount}건</p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              <th className="px-2 py-2">실행일</th>
              <th className="px-2 py-2">채널</th>
              <th className="px-2 py-2">시스템</th>
              <th className="px-2 py-2">확인</th>
              <th className="px-2 py-2">질문</th>
              <th className="px-2 py-2">결과</th>
              <th className="px-2 py-2">유효성</th>
              <th className="px-2 py-2">상세</th>
            </tr>
          </thead>
          <tbody>
            {history.map((run) => (
              <Fragment key={run.runId}>
                <tr className="border-b border-slate-100 align-top">
                  <td className="px-2 py-2 whitespace-nowrap">
                    {new Date(run.createdAt).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-2 py-2">{run.channel}</td>
                  <td className="px-2 py-2">{run.systemStatus}</td>
                  <td className="px-2 py-2">{run.providerConfirmationStatus ?? "—"}</td>
                  <td className="max-w-[180px] truncate px-2 py-2" title={run.query ?? ""}>
                    {run.query ?? "—"}
                  </td>
                  <td className="px-2 py-2">
                    {run.resultCount ?? "—"} / {run.latencyMs != null ? `${run.latencyMs}ms` : "—"}
                  </td>
                  <td className="px-2 py-2">{run.currentValidity ?? "—"}</td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="font-semibold text-sky-800"
                      onClick={() =>
                        setExpandedRunId((id) => (id === run.runId ? null : run.runId))
                      }
                    >
                      {expandedRunId === run.runId ? "접기" : "상세 보기"}
                    </button>
                  </td>
                </tr>
                {expandedRunId === run.runId ? (
                  <tr>
                    <td colSpan={8} className="bg-slate-50 px-3 py-3">
                      <details open className="text-[11px] text-slate-700">
                        <summary className="cursor-pointer font-semibold">운영 로그</summary>
                        <ul className="mt-2 list-disc space-y-1 pl-4 font-mono">
                          <li>Run ID: {run.runId}</li>
                          <li>Confirmation ID: {run.providerConfirmationId ?? "—"}</li>
                          <li>PipelineRun ID: {run.pipelineRunId ?? "—"}</li>
                          <li>IndexGeneration ID: {run.indexGenerationId ?? "—"}</li>
                          <li>NormalizedDocument ID: {run.normalizedDocumentId ?? "—"}</li>
                          <li>Fingerprint: {run.fingerprint ?? "—"}</li>
                          <li>ResultFingerprint: {run.resultFingerprint ?? "—"}</li>
                          <li>Invalidation: {run.invalidationReason ?? "—"}</li>
                          <li>Adapter: {run.adapterPath}</li>
                          <li>Tool: {run.toolName ?? "—"}</li>
                          <li>Protocol: {run.mcpProtocolVersion ?? "—"}</li>
                          <li>Request ID: {run.requestId ?? "—"}</li>
                          <li>Top Chunk ID: {run.topChunkId ?? "—"}</li>
                          <li>SourceDocument ID: {run.sourceDocumentId ?? "—"}</li>
                          <li>페이지: {run.page ?? "—"}</li>
                          <li>
                            실패: {run.failureCode ?? "—"} / {run.failureMessage ?? "—"}
                          </li>
                          <li>
                            실행 사용자: {run.testedByName ?? run.testedByUserId ?? "—"}
                          </li>
                          <li>
                            확인 사용자: {run.confirmedByName ?? run.confirmedByUserId ?? "—"}
                          </li>
                          <li>
                            다운로드 테스트:{" "}
                            {run.downloadTestCompleted
                              ? `완료 (${run.downloadTestedAt ? new Date(run.downloadTestedAt).toLocaleString("ko-KR") : "—"} / ${run.downloadTestedByName ?? "—"} / fileId=${run.downloadTestFileId ?? "—"})`
                              : "—"}
                          </li>
                        </ul>
                      </details>
                      {run.results.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold text-slate-800">검색 결과 Snapshot</p>
                          {run.results.map((item) => (
                            <div
                              key={`${run.runId}-${item.rank}`}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
                            >
                              <p className="font-semibold">
                                #{item.rank} {item.title}
                              </p>
                              <p className="text-store-muted">
                                Chunk={item.chunkId} · Source={item.sourceDocumentId} · score=
                                {item.score}
                              </p>
                              <p className="mt-1">{item.snippet}</p>
                              <p className="mt-1 text-store-muted">
                                {item.sourceDocumentTitle ?? "원문"} · {item.pageStart ?? "—"}
                                {item.pageEnd != null && item.pageEnd !== item.pageStart
                                  ? `–${item.pageEnd}`
                                  : ""}
                                페이지
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          className="min-h-[40px] rounded-lg border border-store-border px-3 text-sm disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          이전
        </button>
        <span className="text-xs text-store-muted">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          className="min-h-[40px] rounded-lg border border-store-border px-3 text-sm disabled:opacity-50"
          onClick={() => setPage((p) => p + 1)}
        >
          다음
        </button>
      </div>
    </section>
  );
}
