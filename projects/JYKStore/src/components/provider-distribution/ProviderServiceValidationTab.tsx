"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  confirmProviderServiceValidationApi,
  fetchProviderServiceValidationApi,
  fetchProviderServiceValidationSourcePreviewApi,
  providerServiceValidationDownloadTestUrl,
  providerSourcePreviewPageUrl,
  rejectProviderServiceValidationApi,
  runProviderServiceValidationApi,
  type ServiceValidationStatusDto,
} from "@/lib/provider-center-api";
import type { ServiceValidationChannelDto } from "@/lib/distribution/service-validation-service";
import type { ProviderValidationResultItemDto } from "@/lib/distribution/service-validation-result-snapshot";
import {
  DOWNLOAD_REJECTION_REASONS,
  RETRIEVAL_REJECTION_REASONS,
} from "@/lib/distribution/service-validation-confirmation-constants";

function systemLabel(status: string): string {
  switch (status) {
    case "NOT_SELECTED":
      return "미선택";
    case "PENDING":
      return "검증 필요";
    case "RUNNING":
      return "검증 중";
    case "PASS":
      return "시스템 검증 완료";
    case "FAIL":
      return "시스템 검증 실패";
    case "STALE":
      return "다시 검증 필요";
    default:
      return status;
  }
}

function confirmLabel(status: string | null | undefined): string {
  switch (status) {
    case "CONFIRMED":
      return "제공자 품질 확인 완료";
    case "REJECTED":
      return "결과 반려";
    case "STALE":
      return "확인 무효";
    case "NOT_REVIEWED":
      return "품질 확인 필요";
    default:
      return "";
  }
}

function badgeClass(kind: "system" | "confirm", status: string | null | undefined): string {
  if (kind === "system") {
    if (status === "PASS") return "bg-emerald-50 text-emerald-800 border-emerald-200";
    if (status === "FAIL" || status === "STALE") return "bg-rose-50 text-rose-800 border-rose-200";
    if (status === "PENDING") return "bg-amber-50 text-amber-900 border-amber-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  }
  if (status === "CONFIRMED") return "bg-sky-50 text-sky-900 border-sky-200";
  if (status === "REJECTED" || status === "STALE") return "bg-rose-50 text-rose-800 border-rose-200";
  return "bg-amber-50 text-amber-900 border-amber-200";
}

const CHANNEL_COPY: Record<string, { title: string; hint: string }> = {
  API: {
    title: "Retrieval API 검증",
    hint: "실제 API와 동일한 검색 경로로 품질을 확인합니다.",
  },
  MCP: {
    title: "MCP 검증",
    hint: "GPT·Cursor 등 MCP 지원 AI에서 지식팩 검색이 정상 동작하는지 확인합니다.",
  },
  DOWNLOAD: {
    title: "원본문서 다운로드 검증",
    hint: "등록한 원본문서 다운로드와 무결성을 확인합니다.",
  },
};

function ResultCard({
  item,
  expanded,
  onToggle,
  onPreview,
}: {
  item: ProviderValidationResultItemDto;
  expanded: boolean;
  onToggle: () => void;
  onPreview: () => void;
}) {
  const relevance =
    item.relevancePercent != null
      ? `관련도 ${item.relevanceLabel} · ${item.relevancePercent}%`
      : `관련도 ${item.relevanceLabel}`;
  return (
    <article className="rounded-xl border border-store-border bg-white px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-500">상위 {item.rank}</p>
          <h4 className="mt-0.5 text-sm font-bold text-slate-900">{item.title}</h4>
          <p className="mt-1 text-xs text-slate-600">{relevance}</p>
          <p className="mt-1 text-xs text-store-muted">
            {item.sourceDocumentTitle}
            {item.pageLabel ? ` · ${item.pageLabel}` : ""}
          </p>
        </div>
      </div>
      <p className={`mt-2 text-sm text-slate-700 ${expanded ? "" : "line-clamp-3"}`}>
        “{item.snippet}”
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="min-h-[44px] rounded-lg border border-store-border px-3 text-xs font-semibold text-slate-700"
        >
          {expanded ? "접기" : "펼쳐보기"}
        </button>
        {item.previewAvailable ? (
          <button
            type="button"
            onClick={onPreview}
            className="min-h-[44px] rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-900"
          >
            원문 위치 확인
          </button>
        ) : (
          <button
            type="button"
            onClick={onPreview}
            className="min-h-[44px] rounded-lg border border-store-border bg-white px-3 text-xs font-semibold text-slate-700"
          >
            원문 위치 정보
          </button>
        )}
      </div>
    </article>
  );
}

function RetrievalConfirmPanel({
  channel,
  packId,
  disabled,
  onDone,
}: {
  channel: ServiceValidationChannelDto;
  packId: string;
  disabled: boolean;
  onDone: () => Promise<void>;
}) {
  const [checks, setChecks] = useState({
    relevanceConfirmed: false,
    contentConfirmed: false,
    sourceConfirmed: false,
    isolationConfirmed: false,
  });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState(RETRIEVAL_REJECTION_REASONS[0]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const allChecked = Object.values(checks).every(Boolean);

  async function handleConfirm() {
    if (!channel.runId || !allChecked || disabled) return;
    setBusy(true);
    setLocalError(null);
    try {
      await confirmProviderServiceValidationApi(packId, channel.runId, checks);
      await onDone();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "품질 확인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!channel.runId || disabled) return;
    setBusy(true);
    setLocalError(null);
    try {
      await rejectProviderServiceValidationApi(packId, channel.runId, {
        rejectionReason: reason,
        comment: comment.trim() || undefined,
      });
      await onDone();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "반려 처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!channel.canConfirm) return null;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-3">
      <p className="text-sm font-semibold text-slate-900">제공자 품질 확인</p>
      {channel.canConfirm ? (
        channel.canShareConfirmationWithPeer ? (
          <p className="text-xs text-store-muted">
            API와 MCP 검색 결과가 동일하여 한 번의 품질 확인으로 함께 완료됩니다.
          </p>
        ) : channel.channel === "API" || channel.channel === "MCP" ? (
          <p className="text-xs text-store-muted">
            API와 MCP의 검색 결과가 달라 각각 품질 확인이 필요합니다.
          </p>
        ) : null
      ) : null}
      {(
        [
          ["relevanceConfirmed", "검색 결과가 테스트 질문과 관련 있습니다."],
          ["contentConfirmed", "검색 결과 내용이 원문과 일치합니다."],
          ["sourceConfirmed", "출처 문서와 페이지가 정확합니다."],
          ["isolationConfirmed", "다른 문서 또는 다른 버전의 내용이 섞이지 않았습니다."],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex min-h-[44px] items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={checks[key]}
            disabled={disabled || busy}
            onChange={(e) => setChecks((prev) => ({ ...prev, [key]: e.target.checked }))}
          />
          <span>{label}</span>
        </label>
      ))}
      {localError ? <p className="text-xs text-rose-700">{localError}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!allChecked || busy || disabled}
          onClick={() => void handleConfirm()}
          className="min-h-[44px] rounded-xl bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          품질 확인 완료
        </button>
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => setRejectOpen((v) => !v)}
          className="min-h-[44px] rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-800"
        >
          결과가 적절하지 않음
        </button>
      </div>
      {rejectOpen ? (
        <div className="space-y-2 rounded-lg border border-rose-200 bg-white p-3">
          <label className="block text-xs font-semibold text-slate-700">
            반려 사유
            <select
              className="mt-1 min-h-[44px] w-full rounded-lg border border-store-border px-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
            >
              {RETRIEVAL_REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            추가 의견 (선택, 최대 1000자)
            <textarea
              className="mt-1 min-h-[88px] w-full rounded-lg border border-store-border px-2 py-2 text-sm"
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => void handleReject()}
            className="min-h-[44px] rounded-xl bg-rose-700 px-4 text-sm font-bold text-white"
          >
            반려 확정
          </button>
          <p className="text-xs text-store-muted">
            검색 결과 품질을 개선하려면 지식 데이터 생성을 다시 실행하거나 자료 등록 상태를 확인해
            주세요.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DownloadConfirmPanel({
  channel,
  packId,
  disabled,
  onDone,
}: {
  channel: ServiceValidationChannelDto;
  packId: string;
  disabled: boolean;
  onDone: () => Promise<void>;
}) {
  const [checks, setChecks] = useState({
    fileNameConfirmed: false,
    downloadOkConfirmed: false,
    fileMatchConfirmed: false,
  });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState(DOWNLOAD_REJECTION_REASONS[0]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const allChecked = Object.values(checks).every(Boolean);

  if (!channel.canConfirm) return null;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-3">
      <p className="text-sm font-semibold text-slate-900">다운로드 품질 확인</p>
      {channel.runId ? (
        <a
          href={providerServiceValidationDownloadTestUrl(packId, channel.runId)}
          className="inline-flex min-h-[44px] items-center rounded-xl border border-store-border bg-white px-4 text-sm font-semibold text-slate-800"
          onClick={() => {
            // After download starts, refresh so downloadTestCompleted becomes true.
            window.setTimeout(() => {
              void onDone();
            }, 800);
          }}
        >
          테스트 다운로드
        </a>
      ) : null}
      {!channel.downloadTestCompleted ? (
        <p className="text-xs text-amber-800">
          테스트 다운로드를 실행한 뒤에 아래 확인 항목을 체크할 수 있습니다.
        </p>
      ) : (
        <p className="text-xs text-emerald-800">
          테스트 다운로드가 시작되고 파일 정보가 정상임을 확인했습니다.
        </p>
      )}
      {(
        [
          ["fileNameConfirmed", "파일명이 올바릅니다."],
          [
            "downloadOkConfirmed",
            "테스트 다운로드가 시작되고 파일 정보가 정상임을 확인했습니다.",
          ],
          ["fileMatchConfirmed", "원본문서가 등록한 파일과 일치합니다."],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex min-h-[44px] items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={checks[key]}
            disabled={
              disabled ||
              busy ||
              (key === "downloadOkConfirmed" && !channel.downloadTestCompleted)
            }
            onChange={(e) => setChecks((prev) => ({ ...prev, [key]: e.target.checked }))}
          />
          <span>{label}</span>
        </label>
      ))}
      {localError ? <p className="text-xs text-rose-700">{localError}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!allChecked || busy || disabled}
          onClick={() => {
            void (async () => {
              if (!channel.runId) return;
              setBusy(true);
              setLocalError(null);
              try {
                await confirmProviderServiceValidationApi(packId, channel.runId, checks);
                await onDone();
              } catch (err) {
                setLocalError(err instanceof Error ? err.message : "확인에 실패했습니다.");
              } finally {
                setBusy(false);
              }
            })();
          }}
          className="min-h-[44px] rounded-xl bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          품질 확인 완료
        </button>
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => setRejectOpen((v) => !v)}
          className="min-h-[44px] rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-800"
        >
          결과가 적절하지 않음
        </button>
      </div>
      {rejectOpen ? (
        <div className="space-y-2 rounded-lg border border-rose-200 bg-white p-3">
          <select
            className="min-h-[44px] w-full rounded-lg border border-store-border px-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
          >
            {DOWNLOAD_REJECTION_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-store-border px-2 py-2 text-sm"
            maxLength={1000}
            placeholder="추가 의견 (선택)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => {
              void (async () => {
                if (!channel.runId) return;
                setBusy(true);
                try {
                  await rejectProviderServiceValidationApi(packId, channel.runId, {
                    rejectionReason: reason,
                    comment: comment.trim() || undefined,
                  });
                  await onDone();
                } catch (err) {
                  setLocalError(err instanceof Error ? err.message : "반려에 실패했습니다.");
                } finally {
                  setBusy(false);
                }
              })();
            }}
            className="min-h-[44px] rounded-xl bg-rose-700 px-4 text-sm font-bold text-white"
          >
            반려 확정
          </button>
        </div>
      ) : null}
    </div>
  );
}

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
  const [expandedRanks, setExpandedRanks] = useState<Record<string, boolean>>({});
  const [showAllResults, setShowAllResults] = useState<Record<string, boolean>>({});
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);

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

  const retrievalConfirmChannel = useMemo(() => {
    const selected = status?.channels.filter((c) => c.selected) ?? [];
    const api = selected.find((c) => c.channel === "API");
    const mcp = selected.find((c) => c.channel === "MCP");
    // Shared confirm UI once on API when both can share; otherwise each channel confirms alone.
    if (api?.canConfirm && api.canShareConfirmationWithPeer) return "API";
    if (mcp?.canConfirm && mcp.canShareConfirmationWithPeer) return "MCP";
    return null;
  }, [status]);

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

  async function handlePreview(channel: ServiceValidationChannelDto, rank: number) {
    if (!channel.runId) return;
    setPreviewMsg(null);
    try {
      const preview = await fetchProviderServiceValidationSourcePreviewApi(
        packId,
        channel.runId,
        rank,
      );
      if (preview.previewFileId) {
        const url = providerSourcePreviewPageUrl({
          packId,
          fileId: preview.previewFileId,
          page: preview.pageStart,
        });
        window.open(url, "_blank", "noopener,noreferrer");
        setPreviewMsg(
          preview.pageLabel
            ? `원문 ${preview.pageLabel.replace("페이지", "")}페이지에서 확인`
            : `원문: ${preview.sourceDocumentTitle}`,
        );
        return;
      }
      const page =
        preview.pageLabel ??
        (preview.pageStart != null ? `${preview.pageStart}페이지` : "페이지 정보 없음");
      setPreviewMsg(
        `원문 위치 정보 · ${preview.sourceDocumentTitle}${preview.fileName ? ` (${preview.fileName})` : ""} · ${page}`,
      );
    } catch (err) {
      setPreviewMsg(err instanceof Error ? err.message : "원문 위치를 확인할 수 없습니다.");
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
          시스템 자동 검증과 제공자 품질 확인을 모두 완료해야 검수요청을 진행할 수 있습니다.
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

      {previewMsg ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          {previewMsg}
        </p>
      ) : null}

      {selected.some((c) => c.channel === "API" || c.channel === "MCP") && canRun ? (
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor="svc-query">
            테스트 질문
          </label>
          <div className="mt-2 flex flex-col gap-2">
            <input
              id="svc-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
            />
            {(status?.suggestedQueries?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-2">
                {status!.suggestedQueries.slice(0, 4).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuery(q)}
                    className="min-h-[36px] rounded-lg border border-store-border bg-slate-50 px-2 text-xs text-slate-700"
                  >
                    {q.length > 28 ? `${q.slice(0, 28)}…` : q}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {selected.map((channel) => {
          const copy = CHANNEL_COPY[channel.channel] ?? { title: channel.channel, hint: "" };
          const showResults = showAllResults[channel.channel];
          const visibleResults = showResults ? channel.results : channel.results.slice(0, 3);
          const hideRetrievalConfirm =
            (channel.channel === "API" || channel.channel === "MCP") &&
            retrievalConfirmChannel != null &&
            channel.channel !== retrievalConfirmChannel &&
            channel.canConfirm &&
            channel.canShareConfirmationWithPeer;

          return (
            <div
              key={channel.channel}
              className="rounded-xl border border-store-border bg-slate-50 px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{copy.title}</p>
                  <p className="mt-1 text-xs text-store-muted">{copy.hint}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${badgeClass("system", channel.systemStatus)}`}
                  >
                    {systemLabel(channel.systemStatus)}
                  </span>
                  {channel.providerConfirmationStatus ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${badgeClass("confirm", channel.providerConfirmationStatus)}`}
                    >
                      {confirmLabel(channel.providerConfirmationStatus)}
                    </span>
                  ) : null}
                </div>
              </div>

              {channel.query && channel.channel !== "DOWNLOAD" ? (
                <p className="mt-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">테스트 질문</span> · {channel.query}
                </p>
              ) : null}

              {channel.failureMessage ? (
                <p className="mt-2 text-sm text-rose-700">{channel.failureMessage}</p>
              ) : null}

              {channel.systemStatus === "PASS" || channel.systemStatus === "STALE" ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">검증 요약</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-700">
                    {channel.channel === "DOWNLOAD" && channel.downloadSummary ? (
                      <>
                        <li>파일명: {channel.downloadSummary.fileName}</li>
                        <li>파일 크기: {channel.downloadSummary.fileSizeLabel}</li>
                        <li>파일 형식: {channel.downloadSummary.mimeLabel}</li>
                        <li>
                          무결성 확인: {channel.downloadSummary.integrityOk ? "정상" : "확인 필요"}
                        </li>
                      </>
                    ) : (
                      <>
                        {channel.resultCount != null ? (
                          <li>검색 결과 {channel.resultCount}건</li>
                        ) : null}
                        {channel.latencyMs != null ? (
                          <li>응답시간 {channel.latencyMs}ms</li>
                        ) : null}
                        <li>
                          {channel.results.length > 0
                            ? "출처와 페이지 연결 정상"
                            : "검색 결과 요약 없음"}
                        </li>
                        {channel.channel === "MCP" ? <li>MCP 검색 도구 실행 정상</li> : null}
                      </>
                    )}
                  </ul>
                </div>
              ) : null}

              {channel.results.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">검색 결과</p>
                  <div className="grid gap-2">
                    {visibleResults.map((item) => (
                      <ResultCard
                        key={`${channel.channel}-${item.rank}`}
                        item={item}
                        expanded={Boolean(expandedRanks[`${channel.channel}-${item.rank}`])}
                        onToggle={() =>
                          setExpandedRanks((prev) => ({
                            ...prev,
                            [`${channel.channel}-${item.rank}`]:
                              !prev[`${channel.channel}-${item.rank}`],
                          }))
                        }
                        onPreview={() => void handlePreview(channel, item.rank)}
                      />
                    ))}
                  </div>
                  {channel.results.length > 3 ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-sky-800"
                      onClick={() =>
                        setShowAllResults((prev) => ({
                          ...prev,
                          [channel.channel]: !prev[channel.channel],
                        }))
                      }
                    >
                      {showResults ? "결과 접기" : `전체 ${channel.results.length}건 펼쳐보기`}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {channel.systemStatus === "FAIL" &&
              channel.failureMessage?.includes("결과가 없습니다") ? (
                <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <p>현재 질문으로 검색된 결과가 없습니다.</p>
                  {canRun ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="min-h-[44px] rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold"
                        onClick={() => {
                          if (status?.suggestedQuery) setQuery(status.suggestedQuery);
                        }}
                      >
                        추천 질문으로 다시 검증
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {channel.confirmation?.status === "CONFIRMED" ? (
                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                  제공자 품질 확인 완료
                  {channel.confirmation.confirmedByName
                    ? ` · 확인자: ${channel.confirmation.confirmedByName}`
                    : ""}
                  {channel.confirmation.confirmedAt
                    ? ` · ${new Date(channel.confirmation.confirmedAt).toLocaleString("ko-KR")}`
                    : ""}
                  {channel.confirmation.sharedWithChannels.length
                    ? ` · ${channel.confirmation.sharedWithChannels.join(", ")}와 공통 확인`
                    : ""}
                </p>
              ) : null}

              {channel.confirmation?.status === "REJECTED" ? (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                  반려됨
                  {channel.confirmation.rejectionReason
                    ? ` · ${channel.confirmation.rejectionReason}`
                    : ""}
                  . 다시 검증해 주세요.
                </p>
              ) : null}

              {!hideRetrievalConfirm && channel.channel !== "DOWNLOAD" ? (
                <RetrievalConfirmPanel
                  channel={channel}
                  packId={packId}
                  disabled={!canRun}
                  onDone={load}
                />
              ) : null}
              {channel.channel === "DOWNLOAD" ? (
                <DownloadConfirmPanel
                  channel={channel}
                  packId={packId}
                  disabled={!canRun}
                  onDone={load}
                />
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
                    : channel.systemStatus === "PASS"
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
            선택한 모든 제공 방식의 시스템 검증과 제공자 품질 확인이 완료되었습니다.
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
