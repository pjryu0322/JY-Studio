"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  confirmProviderServiceValidationApi,
  fetchProviderSearchDataStatusApi,
  fetchProviderServiceValidationApi,
  fetchProviderServiceValidationSourcePreviewApi,
  generateProviderSearchDataApi,
  providerServiceValidationDownloadTestUrl,
  providerSourcePreviewPageUrl,
  rejectProviderServiceValidationApi,
  runProviderServiceValidationApi,
  validateProviderSearchDataApi,
  type DoclingKnowledgePipelineStatusDto,
  type SearchDataStatusDto,
  type ServiceValidationStatusDto,
} from "@/lib/provider-center-api";
import type { ServiceValidationChannelDto } from "@/lib/distribution/service-validation-service";
import type { ProviderValidationResultItemDto } from "@/lib/distribution/service-validation-result-snapshot";
import {
  DOWNLOAD_REJECTION_REASONS,
  RETRIEVAL_REJECTION_REASONS,
} from "@/lib/distribution/service-validation-confirmation-constants";
import {
  isRankingPolicyStaleRun,
  resolveSearchDataNotReadyBanner,
  resolveSearchValidationGuidance,
  resolveSearchValidationStepDisplayState,
  resolveSearchValidationWorkSteps,
  type SearchValidationStepDisplayState,
} from "@/lib/search-data/search-validation-ux-state";

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
      return "품질 확인 완료";
    case "REJECTED":
      return "보완 필요";
    case "STALE":
      return "다시 확인 필요";
    case "NOT_REVIEWED":
      return "품질 확인 필요";
    default:
      return "";
  }
}

function badgeClass(kind: "system" | "confirm" | "neutral", status: string | null | undefined): string {
  if (kind === "neutral") return "bg-slate-50 text-slate-700 border-slate-200";
  if (kind === "system") {
    if (status === "PASS") return "bg-emerald-50 text-emerald-800 border-emerald-200";
    if (status === "FAIL" || status === "STALE") return "bg-rose-50 text-rose-800 border-rose-200";
    if (status === "PENDING" || status === "RUNNING") return "bg-sky-50 text-sky-900 border-sky-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  }
  if (status === "CONFIRMED") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "REJECTED" || status === "STALE") return "bg-rose-50 text-rose-800 border-rose-200";
  return "bg-amber-50 text-amber-900 border-amber-200";
}

function providerConfirmAggregate(
  channels: ServiceValidationChannelDto[],
): "CONFIRMED" | "REJECTED" | "STALE" | "NOT_REVIEWED" {
  const retrieval = channels.filter((c) => c.channel === "API" || c.channel === "MCP");
  if (retrieval.some((c) => c.providerConfirmationStatus === "STALE" || c.systemStatus === "STALE")) {
    return "STALE";
  }
  if (retrieval.some((c) => c.providerConfirmationStatus === "REJECTED")) return "REJECTED";
  if (
    retrieval.length > 0 &&
    retrieval.every(
      (c) =>
        c.providerConfirmationStatus === "CONFIRMED" ||
        (!c.selected && c.systemStatus === "NOT_SELECTED"),
    ) &&
    retrieval.some((c) => c.providerConfirmationStatus === "CONFIRMED")
  ) {
    return "CONFIRMED";
  }
  return "NOT_REVIEWED";
}

const CHANNEL_COPY: Record<string, { title: string; hint: string }> = {
  API: {
    title: "Retrieval API 검색",
    hint: "실제 API와 동일한 검색 경로로 결과 품질을 확인합니다.",
  },
  MCP: {
    title: "MCP 검색",
    hint: "GPT·Cursor 등 MCP 지원 AI에서 지식팩 검색이 정상 동작하는지 확인합니다.",
  },
  DOWNLOAD: {
    title: "RAG Export 패키지 검증",
    hint: "외부 RAG 시스템에서 사용할 수 있는 지식팩 패키지가 정상적으로 생성되고 다운로드·검증되는지 확인합니다.",
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
      ? `관련도: ${item.relevanceLabel} · ${item.relevancePercent}%`
      : `관련도: ${item.relevanceLabel}`;
  const pageText = item.pageLabel?.trim() ? item.pageLabel : "페이지 정보 없음";
  return (
    <article className="rounded-xl border border-store-border bg-white px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500">상위 {item.rank}</p>
          <h4 className="mt-0.5 line-clamp-2 text-sm font-bold text-slate-900">{item.title}</h4>
          <p className="mt-1 text-xs text-slate-600">{relevance}</p>
          <div className="mt-1 space-y-0.5 text-xs text-store-muted">
            <p>
              <span className="font-semibold text-slate-700">출처:</span>{" "}
              {item.sourceDocumentTitle || "출처 정보 없음"}
            </p>
            <p>
              <span className="font-semibold text-slate-700">페이지:</span> {pageText}
            </p>
          </div>
        </div>
      </div>
      <p className={`mt-2 text-sm text-slate-700 ${expanded ? "" : "line-clamp-3"}`}>
        “{item.snippet}”
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
        <button
          type="button"
          onClick={onToggle}
          className="min-h-[44px] rounded-lg border border-store-border px-3 text-xs font-semibold text-slate-700"
        >
          {expanded ? "접기" : "펼쳐보기"}
        </button>
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
          className="min-h-[44px] rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          결과 적절함
        </button>
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => setRejectOpen((v) => !v)}
          className="min-h-[44px] rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-800"
        >
          검색 결과 보완 필요
        </button>
      </div>
      {rejectOpen ? (
        <div className="space-y-2 rounded-lg border border-rose-200 bg-white p-3">
          <label className="block text-xs font-semibold text-slate-700">
            보완 사유
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
            다른 질문으로 다시 검색하고 보완 사유를 확인해 주세요. 관련 내용이 검색 후보에도
            나타나지 않을 때 데이터 구조화를 점검하세요.
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

  if (!channel.canConfirm && !channel.runId) return null;
  // PASS + CURRENT 이면 다운로드·확인 UI를 보여 준다 (canConfirm이 잠깐 false여도 runId 기준).
  const showPanel =
    channel.canConfirm ||
    (channel.systemStatus === "PASS" &&
      channel.currentValidity === "CURRENT" &&
      channel.providerConfirmationStatus === "NOT_REVIEWED" &&
      Boolean(channel.runId));
  if (!showPanel) return null;

  const summary = channel.downloadSummary;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-3">
      <p className="text-sm font-semibold text-slate-900">RAG Export 품질 확인</p>
      <p className="text-xs leading-snug text-slate-700">
        패키지를 다운로드해 Chunk·출처·Checksum을 확인한 뒤 아래 항목을 체크해 주세요.
      </p>
      {summary ? (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-700">
          <li>
            Schema {summary.schemaVersion ?? "—"} · Chunk {summary.chunkCount ?? "—"}개 · Source{" "}
            {summary.sourceCount ?? "—"}개
          </li>
          <li>
            Manifest {summary.manifestValid ? "정상" : "확인 필요"} · Source Trace{" "}
            {summary.sourceTraceValid ? "정상" : "확인 필요"} · Checksum{" "}
            {summary.checksumsValid ? "정상" : "확인 필요"}
          </li>
          <li>
            Vector 미포함 · 원본문서 Binary 미포함
          </li>
        </ul>
      ) : null}
      {channel.runId ? (
        <a
          href={providerServiceValidationDownloadTestUrl(packId, channel.runId)}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-sky-200 bg-white px-4 text-sm font-semibold text-sky-950 sm:w-auto"
          onClick={() => {
            // After download starts, refresh so downloadTestCompleted becomes true.
            window.setTimeout(() => {
              void onDone();
            }, 800);
          }}
        >
          RAG Export 다운로드
        </a>
      ) : null}
      {!channel.downloadTestCompleted ? (
        <p className="text-xs text-amber-800">
          먼저 패키지를 다운로드한 뒤 확인 항목을 체크할 수 있습니다.
        </p>
      ) : (
        <p className="text-xs text-emerald-800">
          다운로드가 시작되었습니다. 패키지 내용을 확인한 뒤 아래 항목을 체크해 주세요.
        </p>
      )}
      {(
        [
          ["fileNameConfirmed", "패키지에 현재 지식팩의 Chunk가 포함되어 있습니다."],
          [
            "downloadOkConfirmed",
            "Chunk에서 원문 출처와 페이지를 확인할 수 있습니다.",
          ],
          [
            "fileMatchConfirmed",
            "Manifest와 Checksum 검증 결과가 정상이며 원본문서 Binary가 포함되지 않았습니다.",
          ],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex min-h-[44px] items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={checks[key]}
            disabled={disabled || busy || !channel.downloadTestCompleted}
            onChange={(e) => setChecks((prev) => ({ ...prev, [key]: e.target.checked }))}
          />
          <span>{label}</span>
        </label>
      ))}
      {localError ? <p className="text-xs text-rose-700">{localError}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={
            !allChecked || busy || disabled || !channel.downloadTestCompleted || !channel.canConfirm
          }
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
          RAG Export 품질 확인 완료
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
  knowledgeStatus: _knowledgeStatus,
  onGoToDistributionReview,
  onGoToReview,
  onGoToKnowledge,
  onStatusChange,
  onSearchDataStateChange,
  onSearchDataMetaChange,
}: {
  readonly packId: string;
  readonly editable: boolean;
  /** @deprecated Search-data status API is authoritative; kept for caller compat. */
  readonly knowledgeStatus?: DoclingKnowledgePipelineStatusDto | null;
  readonly onGoToDistributionReview?: () => void;
  /** @deprecated Prefer onGoToDistributionReview */
  readonly onGoToReview?: () => void;
  readonly onGoToKnowledge?: () => void;
  readonly onStatusChange?: (status: ServiceValidationStatusDto) => void;
  readonly onSearchDataStateChange?: (
    state: import("@/lib/search-data/search-data-state").SearchDataUiState | null,
  ) => void;
  readonly onSearchDataMetaChange?: (meta: { rankingPolicyStale: boolean }) => void;
}) {
  void _knowledgeStatus;
  const [status, setStatus] = useState<ServiceValidationStatusDto | null>(null);
  const [searchData, setSearchData] = useState<SearchDataStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [executedQuery, setExecutedQuery] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [runningChannel, setRunningChannel] = useState<string | null>(null);
  const [expandedRanks, setExpandedRanks] = useState<Record<string, boolean>>({});
  const [showAllResults, setShowAllResults] = useState<Record<string, boolean>>({});
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [techOpen, setTechOpen] = useState(false);

  const notifySearchData = useCallback(
    (data: SearchDataStatusDto) => {
      setSearchData(data);
      onSearchDataStateChange?.(data.state);
      onSearchDataMetaChange?.({ rankingPolicyStale: Boolean(data.rankingPolicyStale) });
    },
    [onSearchDataStateChange, onSearchDataMetaChange],
  );

  const loadSearchData = useCallback(async () => {
    const data = await fetchProviderSearchDataStatusApi(packId);
    notifySearchData(data);
    return data;
  }, [packId, notifySearchData]);

  const load = useCallback(async () => {
    try {
      const [svc, sd] = await Promise.all([
        fetchProviderServiceValidationApi(packId),
        fetchProviderSearchDataStatusApi(packId),
      ]);
      setStatus(svc);
      notifySearchData(sd);
      onStatusChange?.(svc);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색데이터 검증 상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId, onStatusChange, notifySearchData]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [packId]);

  useEffect(() => {
    if (searchData?.state !== "CREATING" && searchData?.state !== "VALIDATING") return;
    const id = window.setInterval(() => {
      void loadSearchData().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(id);
  }, [searchData?.state, loadSearchData]);

  const searchReady = searchData?.state === "VALIDATED";
  const canRun = Boolean(editable && status?.canRunValidation && searchData?.canRunServiceValidation);

  const retrievalConfirmChannel = useMemo(() => {
    const selected = status?.channels.filter((c) => c.selected) ?? [];
    const api = selected.find((c) => c.channel === "API");
    const mcp = selected.find((c) => c.channel === "MCP");
    if (api?.canConfirm && api.canShareConfirmationWithPeer) return "API";
    if (mcp?.canConfirm && mcp.canShareConfirmationWithPeer) return "MCP";
    return null;
  }, [status]);

  async function handleGenerate(forceRegenerate = false) {
    if (!editable || searchBusy) return;
    setSearchBusy(true);
    setError(null);
    try {
      await generateProviderSearchDataApi(packId, { forceRegenerate });
      // 202 enqueue → poll authoritative status (do not surface card failures as global alert).
      await loadSearchData();
    } catch (err) {
      // Network / unexpected server errors only — CREATE_FAILED lives in the card.
      setError(err instanceof Error ? err.message : "검색데이터 요청에 실패했습니다.");
      await loadSearchData().catch(() => undefined);
    } finally {
      setSearchBusy(false);
    }
  }

  async function handleValidateQuality() {
    if (!editable || searchBusy) return;
    setSearchBusy(true);
    setError(null);
    try {
      const next = await validateProviderSearchDataApi(packId);
      notifySearchData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색 품질 검증에 실패했습니다.");
      await loadSearchData().catch(() => undefined);
    } finally {
      setSearchBusy(false);
    }
  }

  async function handleRun(
    channel: "API" | "MCP" | "DOWNLOAD",
    queryOverride?: string,
  ) {
    if (!canRun) return;
    if (channel !== "DOWNLOAD") {
      const trimmed = (queryOverride ?? draftQuery).trim();
      if (trimmed.length < 2) {
        setQueryError("검색할 질문을 입력해 주세요.");
        return;
      }
      setQueryError(null);
      if (queryOverride != null) setDraftQuery(queryOverride);
    }
    setRunningChannel(channel);
    setError(null);
    try {
      const trimmed = (queryOverride ?? draftQuery).trim();
      await runProviderServiceValidationApi(packId, {
        channel,
        query: channel === "DOWNLOAD" ? undefined : trimmed,
      });
      if (channel !== "DOWNLOAD") {
        setExecutedQuery(trimmed);
      }
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
      if (preview.previewFileId || preview.pageStart != null || preview.sourceDocumentTitle) {
        const url = providerSourcePreviewPageUrl({
          packId,
          runId: channel.runId,
          rank,
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

  const selected = status?.channels.filter((c) => c.selected) ?? [];
  const goToDistributionReview = onGoToDistributionReview ?? onGoToReview;
  const preparationPassed = Boolean(
    status?.allPreparationChannelsPassed ?? status?.allSelectedPassed,
  );
  const showTestQuestions =
    searchData?.state === "CREATED" ||
    searchData?.state === "VALIDATED" ||
    searchData?.state === "VALIDATION_FAILED";

  const channelSnap = (name: "API" | "MCP" | "DOWNLOAD") => {
    const c = status?.channels.find((x) => x.channel === name);
    return c
      ? {
          systemStatus: c.systemStatus,
          currentValidity: c.currentValidity,
          providerConfirmationStatus: c.providerConfirmationStatus,
        }
      : null;
  };

  const displayState: SearchValidationStepDisplayState = resolveSearchValidationStepDisplayState({
    searchDataState: searchData?.state,
    rankingPolicyStale: searchData?.rankingPolicyStale,
    canRunServiceValidation: searchData?.canRunServiceValidation,
    api: channelSnap("API"),
    mcp: channelSnap("MCP"),
    download: channelSnap("DOWNLOAD"),
  });
  const guidance = resolveSearchValidationGuidance({
    displayState,
    rankingPolicyStale: searchData?.rankingPolicyStale,
  });
  const workSteps = resolveSearchValidationWorkSteps(displayState);
  const showWorkOrder =
    displayState === "AUTO_EVALUATION_REQUIRED" ||
    displayState === "SERVICE_REVALIDATION_REQUIRED" ||
    displayState === "PROVIDER_REVIEW_REQUIRED";

  if (loading) {
    return <p className="text-sm text-store-muted">검색데이터 검증 상태를 불러오는 중…</p>;
  }

  const sd = searchData;

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div>
        <h2 className="text-base font-bold text-slate-900">검색데이터 생성·검증</h2>
        <p className="mt-1 text-sm text-store-muted">
          구조화된 데이터를 검색 가능한 형태로 생성하고 검색 품질을 확인합니다.
        </p>
        <p className="mt-1 text-xs text-store-muted">
          검색데이터가 준비되면 API와 MCP 연결도 검증할 수 있습니다.
        </p>
      </div>

      <div className="rounded-xl border border-store-border bg-slate-50 px-3 py-3">
        <p className="text-sm font-bold text-slate-900">검색데이터</p>
        {sd?.state === "STALE" ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-slate-800">{sd.message}</p>
            <button
              type="button"
              onClick={() => onGoToKnowledge?.()}
              className="min-h-[44px] rounded-xl bg-slate-800 px-4 text-sm font-bold text-white"
            >
              데이터 구조화로 이동
            </button>
          </div>
        ) : null}

        {sd?.state === "NOT_CREATED" ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-slate-800">
              현재 구조화 결과로 생성된 검색데이터가 없습니다.
            </p>
            {sd.chunkCount > 0 ? (
              <p className="text-xs text-store-muted">
                검색 단위 {sd.chunkCount}개를 검색데이터로 변환합니다.
              </p>
            ) : null}
            <button
              type="button"
              disabled={!editable || !sd.canGenerate || searchBusy}
              onClick={() => void handleGenerate(false)}
              className="min-h-[44px] rounded-xl bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {searchBusy ? "생성 중…" : "검색데이터 생성"}
            </button>
          </div>
        ) : null}

        {sd?.state === "CREATING" ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-semibold text-slate-900">검색데이터 생성 중</p>
            <p className="text-xs text-store-muted">
              처리 {sd.processedCount} / {sd.chunkCount || "…"}
            </p>
            <button
              type="button"
              disabled={searchBusy}
              onClick={() => void loadSearchData()}
              className="min-h-[44px] rounded-xl border border-store-border bg-white px-4 text-sm font-semibold text-slate-800"
            >
              진행 상태 새로고침
            </button>
          </div>
        ) : null}

        {sd?.state === "CREATE_FAILED" ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-semibold text-rose-800">검색데이터 생성 실패</p>
            <p className="text-sm leading-snug text-slate-800">{sd.message}</p>
            {sd.supportRequired ? (
              <p className="text-xs text-store-muted">관리자에게 문의가 필요합니다.</p>
            ) : null}
            {sd.failureCode === "EMBEDDING_TOKEN_LIMIT_EXCEEDED" ? (
              <button
                type="button"
                onClick={() => onGoToKnowledge?.()}
                className="min-h-[44px] rounded-xl bg-slate-800 px-4 text-sm font-bold text-white"
              >
                데이터 구조화로 이동
              </button>
            ) : (
              <button
                type="button"
                disabled={!editable || searchBusy}
                onClick={() => void handleGenerate(true)}
                className="min-h-[44px] rounded-xl bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                검색데이터 다시 생성
              </button>
            )}
          </div>
        ) : null}

        {sd?.state === "CREATED" ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-semibold text-emerald-900">검색데이터 생성 완료</p>
            <ul className="grid grid-cols-2 gap-1 text-xs text-slate-700 sm:grid-cols-4">
              <li>검색 단위 {sd.chunkCount}</li>
              <li>벡터 {sd.vectorCount}</li>
              <li>모델 {sd.modelLabel ?? sd.model ?? "—"}</li>
              <li>차원 {sd.dimension ?? "—"}</li>
            </ul>
            <button
              type="button"
              disabled={!editable || !sd.canValidate || searchBusy}
              onClick={() => void handleValidateQuality()}
              className="min-h-[44px] rounded-xl bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {searchBusy ? "검증 중…" : "검색 품질 검증"}
            </button>
          </div>
        ) : null}

        {sd?.state === "VALIDATING" ? (
          <div className="mt-2">
            <p className="text-sm font-semibold text-slate-900">검색 품질 검증 중</p>
          </div>
        ) : null}

        {sd?.state === "VALIDATION_FAILED" ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-semibold text-rose-800">검색 품질 보완 필요</p>
            <p className="text-sm leading-snug text-slate-800">
              테스트 질문 일부가 기준을 충족하지 못했습니다.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!editable || searchBusy}
                onClick={() => void handleValidateQuality()}
                className="min-h-[44px] rounded-xl border border-store-border bg-white px-4 text-sm font-semibold"
              >
                다시 검증
              </button>
              <button
                type="button"
                disabled={!editable || searchBusy}
                onClick={() => void handleGenerate(true)}
                className="min-h-[44px] rounded-xl bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                검색데이터 다시 생성
              </button>
            </div>
          </div>
        ) : null}

        {sd?.state === "VALIDATED" ? (
          <div className="mt-2 space-y-3">
            <div className="space-y-1">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
                <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                  검색데이터 생성 완료
                </span>
                <span
                  className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                    sd.rankingPolicyStale
                      ? "border-sky-200 bg-sky-50 text-sky-900"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                  }`}
                >
                  {sd.rankingPolicyStale ? "자동 평가 다시 필요" : "자동 평가 통과"}
                </span>
                {sd.rankingPolicyStale ? (
                  <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    제공자 품질 확인 · 검색검증 후 가능
                  </span>
                ) : (
                  <span
                    className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                      providerConfirmAggregate(selected) !== "CONFIRMED"
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {providerConfirmAggregate(selected) === "CONFIRMED"
                      ? "제공자 품질 확인 완료"
                      : "제공자 품질 확인 필요"}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-emerald-900">검색데이터 준비 완료</p>
              <p className="text-xs text-slate-700">
                검색 단위 {sd.chunkCount} · 벡터 {sd.vectorCount} · {sd.modelLabel ?? sd.model ?? "Local E5"}
                {sd.dimension != null ? ` · ${sd.dimension}차원` : ""}
              </p>
            </div>

            {showWorkOrder ? (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3">
                <p className="text-sm font-semibold text-amber-950">{guidance.title}</p>
                {guidance.body.map((line) => (
                  <p key={line} className="text-xs leading-snug text-amber-900">
                    {line}
                  </p>
                ))}
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
                    현재 작업
                  </p>
                  <ol className="space-y-1 text-xs text-amber-950 sm:hidden">
                    {workSteps.map((step, idx) => (
                      <li key={step.id}>
                        {idx + 1}. {step.label}
                        {step.status === "current"
                          ? " · 현재"
                          : step.status === "done"
                            ? " · 완료"
                            : " · 대기"}
                      </li>
                    ))}
                  </ol>
                  <p className="hidden text-xs text-amber-950 sm:block">
                    {workSteps.map((s) => s.label).join(" → ")}
                  </p>
                </div>
                {sd.rankingPolicyStale ? (
                  <>
                    <button
                      type="button"
                      disabled={!editable || !sd.canValidate || searchBusy}
                      onClick={() => void handleValidateQuality()}
                      className="min-h-[44px] w-full rounded-xl bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
                    >
                      {searchBusy ? "실행 중..." : "자동 평가 다시 실행"}
                    </button>
                    <p className="text-xs text-amber-900">
                      기존 검색데이터는 유지하고 현재 검색 순위 정책으로 평가만 다시 실행합니다.
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}

            {!sd.rankingPolicyStale && sd.validationSummary && sd.validationSummary.totalCases > 0 ? (
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                      sd.validationSummary.status === "PASS"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    {sd.validationSummary.status === "PASS" ? "자동 평가 통과" : "자동 평가 보완 필요"}
                  </span>
                  <p className="text-sm font-semibold text-slate-900">자동 검색 평가</p>
                </div>
                <p className="text-xs text-slate-700">
                  평가 질문 {sd.validationSummary.totalCases}건 중 {sd.validationSummary.passedCases}건 통과
                </p>
              </div>
            ) : null}
            {!sd.rankingPolicyStale
              ? (() => {
                  const confirmState = providerConfirmAggregate(selected);
                  return (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${badgeClass("confirm", confirmState)}`}
                        >
                          {confirmLabel(confirmState)}
                        </span>
                        <p className="text-sm font-semibold text-slate-900">제공자 품질 확인</p>
                      </div>
                      {confirmState === "NOT_REVIEWED" || confirmState === "STALE" ? (
                        <p className="text-xs text-slate-700">
                          실제 질문으로 검색한 뒤 결과의 관련성과 출처를 확인하세요.
                        </p>
                      ) : null}
                    </div>
                  );
                })()
              : null}
          </div>
        ) : null}

        {sd?.technical?.legacyLocalHashPresent &&
        (sd.state === "NOT_CREATED" || sd.state === "CREATE_FAILED") ? (
          <p className="mt-3 text-xs text-store-muted">
            이전 개발용 검색 결과가 있습니다. 현재 구조화 결과의 검색데이터를 새로 생성해야 합니다.
          </p>
        ) : null}

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setTechOpen((v) => !v)}
            className="min-h-[44px] text-xs font-semibold text-slate-600 underline-offset-2 hover:underline"
          >
            {techOpen ? "기술정보 접기" : "기술정보 보기"}
          </button>
          {techOpen && sd?.technical ? (
            <ul className="mt-2 space-y-1 break-all rounded-lg border border-store-border bg-white px-3 py-2 font-mono text-[11px] text-slate-600">
              <li>Generation: {sd.technical.searchIndexGenerationId ?? "—"}</li>
              <li>Attempt: {sd.technical.attempt ?? "—"}</li>
              <li>Chunk Gen: {sd.technical.chunkGenerationId ?? "—"}</li>
              <li>PipelineRun: {sd.technical.pipelineRunId ?? "—"}</li>
              <li>ND: {sd.technical.normalizedDocumentId ?? "—"}</li>
              <li>Fingerprint: {sd.technical.fingerprint ?? "—"}</li>
              <li>Provider: {sd.technical.embeddingProvider ?? "—"}</li>
              <li>Model: {sd.technical.embeddingModel ?? "—"}</li>
              <li>Revision: {sd.technical.embeddingModelRevision ?? "—"}</li>
              <li>Dimension: {sd.technical.dimension ?? "—"}</li>
              <li>Vectors: {sd.technical.vectorCount ?? 0}</li>
              <li>
                Scope/Status: {sd.technical.indexScope ?? "—"} / {sd.technical.indexStatus ?? "—"}
              </li>
              <li>Failure: {sd.technical.failureCode ?? "—"}</li>
            </ul>
          ) : null}
        </div>
      </div>

      {!status?.canRunValidation ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {status?.validationLockReason === "OPEN_REVIEW"
            ? "검수요청 시점의 검증 결과입니다. 변경하려면 검수요청을 회수해 주세요."
            : status?.validationLockReason === "PACK_NOT_DRAFT"
              ? "현재 지식팩 상태에서는 검색검증 결과를 변경할 수 없습니다."
              : status?.validationLockReason === "BINDING_MISSING"
                ? "현재 데이터 구조화 결과와 검색검증 연결을 확인할 수 없습니다."
                : status?.validationLockReason === "BINDING_STALE"
                  ? "자료 또는 구조화 결과가 변경되었습니다. 데이터 구조화를 확인해 주세요."
                  : status?.validationLockReason === "SEARCH_DATA_NOT_READY"
                    ? resolveSearchDataNotReadyBanner({
                        rankingPolicyStale: Boolean(sd?.rankingPolicyStale),
                        searchDataState: sd?.state,
                      })
                    : "현재 상태에서는 검색검증을 변경할 수 없습니다."}
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

      {!searchReady &&
      (sd?.state === "CREATED" ||
        sd?.state === "VALIDATING" ||
        sd?.state === "VALIDATION_FAILED") ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          검색 품질 검증을 완료하면 API·MCP 검증을 진행할 수 있습니다.
        </p>
      ) : null}

      {showTestQuestions &&
      selected.some((c) => c.channel === "API" || c.channel === "MCP") &&
      searchReady &&
      canRun ? (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700" htmlFor="svc-query">
            검색 질문
          </label>
          <input
            id="svc-query"
            value={draftQuery}
            onChange={(e) => {
              setDraftQuery(e.target.value);
              if (queryError) setQueryError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (selected.some((c) => c.channel === "API")) void handleRun("API");
                else if (selected.some((c) => c.channel === "MCP")) void handleRun("MCP");
              }
            }}
            placeholder="예: 기획단계 대가 산정 방법을 알려주세요."
            className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
            disabled={runningChannel != null}
          />
          {queryError ? <p className="text-xs text-rose-700">{queryError}</p> : null}
          <div className="flex flex-wrap gap-2">
            {selected.some((c) => c.channel === "API") ? (
              <button
                type="button"
                disabled={runningChannel != null}
                onClick={() => void handleRun("API")}
                className="min-h-[44px] rounded-xl bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {runningChannel === "API" ? "검색 중…" : "API 검색"}
              </button>
            ) : null}
            {selected.some((c) => c.channel === "MCP") ? (
              <button
                type="button"
                disabled={runningChannel != null}
                onClick={() => void handleRun("MCP")}
                className="min-h-[44px] rounded-xl border border-store-border bg-white px-4 text-sm font-semibold text-slate-800 disabled:opacity-50"
              >
                {runningChannel === "MCP" ? "검색 중…" : "MCP 검색"}
              </button>
            ) : null}
            {executedQuery || selected.some((c) => c.query && (c.channel === "API" || c.channel === "MCP")) ? (
              <button
                type="button"
                disabled={runningChannel != null}
                onClick={() => {
                  setDraftQuery("");
                  setQueryError(null);
                  document.getElementById("svc-query")?.focus();
                }}
                className="min-h-[44px] rounded-xl border border-store-border bg-white px-4 text-sm font-semibold text-slate-700"
              >
                다른 질문으로 다시 검색
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {searchReady ? (
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
          const previousPolicyResult =
            (channel.channel === "API" || channel.channel === "MCP") &&
            isRankingPolicyStaleRun({
              systemStatus: channel.systemStatus,
              currentValidity: channel.currentValidity,
            });
          const confirmBlockedByStale =
            previousPolicyResult || channel.providerConfirmationStatus === "STALE";

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
                  {previousPolicyResult ? (
                    <>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                        이전 정책 결과
                      </span>
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-900">
                        재검색 필요
                      </span>
                    </>
                  ) : (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${badgeClass("system", channel.systemStatus)}`}
                    >
                      {systemLabel(channel.systemStatus)}
                    </span>
                  )}
                  {channel.providerConfirmationStatus ? (
                    previousPolicyResult || channel.providerConfirmationStatus === "STALE" ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                        {channel.providerConfirmationStatus === "CONFIRMED" ||
                        channel.confirmation?.status === "CONFIRMED"
                          ? "이전 확인 결과 · 다시 확인 필요"
                          : "품질 확인 대기"}
                      </span>
                    ) : (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${badgeClass("confirm", channel.providerConfirmationStatus)}`}
                      >
                        {confirmLabel(channel.providerConfirmationStatus)}
                      </span>
                    )
                  ) : null}
                </div>
              </div>

              {(channel.query || executedQuery) && channel.channel !== "DOWNLOAD" ? (
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">실행 질문</span> ·{" "}
                    {channel.query || executedQuery}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">검색 경로</span> ·{" "}
                    {channel.channel === "API" ? "Retrieval API" : "MCP"}
                  </p>
                </div>
              ) : null}

              {previousPolicyResult && channel.results.length > 0 ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  이 결과는 이전 검색 순위 정책으로 실행한 참고용 결과입니다. 자동 평가 완료 후 같은
                  질문 또는 새 질문으로 다시 검색해 주세요.
                </p>
              ) : null}

              {!canRun &&
              (channel.channel === "API" || channel.channel === "MCP") &&
              (sd?.rankingPolicyStale || displayState === "AUTO_EVALUATION_REQUIRED") ? (
                <p className="mt-3 text-xs text-slate-700">
                  자동 평가를 완료하면 {channel.channel === "API" ? "API" : "MCP"} 검색을 다시 실행할
                  수 있습니다.
                </p>
              ) : null}

              {canRun &&
              (channel.channel === "API" || channel.channel === "MCP") &&
              channel.query &&
              previousPolicyResult ? (
                <button
                  type="button"
                  disabled={runningChannel != null}
                  onClick={() => {
                    const q = channel.query ?? "";
                    setDraftQuery(q);
                    setQueryError(null);
                    void handleRun(channel.channel as "API" | "MCP", q);
                  }}
                  className="mt-3 min-h-[44px] w-full rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-semibold text-sky-950 disabled:opacity-60 sm:w-auto"
                >
                  {runningChannel === channel.channel
                    ? "검색 중…"
                    : "같은 질문으로 다시 검색"}
                </button>
              ) : null}

              {channel.failureMessage ? (
                <p className="mt-2 text-sm text-rose-700">{channel.failureMessage}</p>
              ) : null}

              {channel.systemStatus === "PASS" || channel.systemStatus === "STALE" ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">검색 요약</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-700">
                    {channel.channel === "DOWNLOAD" && channel.downloadSummary ? (
                      <>
                        <li>파일명: {channel.downloadSummary.fileName}</li>
                        {channel.downloadSummary.schemaVersion ? (
                          <li>Schema: {channel.downloadSummary.schemaVersion}</li>
                        ) : null}
                        {channel.downloadSummary.chunkCount != null ? (
                          <li>Chunk: {channel.downloadSummary.chunkCount}개</li>
                        ) : null}
                        {channel.downloadSummary.sourceCount != null ? (
                          <li>Source: {channel.downloadSummary.sourceCount}개</li>
                        ) : null}
                        <li>
                          Manifest:{" "}
                          {channel.downloadSummary.manifestValid ? "정상" : "확인 필요"}
                        </li>
                        <li>
                          Source Trace:{" "}
                          {channel.downloadSummary.sourceTraceValid ? "정상" : "확인 필요"}
                        </li>
                        <li>
                          Checksum:{" "}
                          {channel.downloadSummary.checksumsValid ? "정상" : "확인 필요"}
                        </li>
                        <li>
                          Vector 포함:{" "}
                          {channel.downloadSummary.vectorsIncluded ? "예" : "아니오"}
                        </li>
                        <li>
                          원본문서 포함:{" "}
                          {channel.downloadSummary.sourceFilesIncluded ? "예" : "아니오"}
                        </li>
                        <li>파일 크기: {channel.downloadSummary.fileSizeLabel}</li>
                      </>
                    ) : (
                      <>
                        {channel.resultCount != null ? (
                          <li>검색 결과 {channel.resultCount}건</li>
                        ) : null}
                        <li>고유 결과 {channel.results.length}건</li>
                        {channel.latencyMs != null ? (
                          <li>응답시간 {channel.latencyMs}ms</li>
                        ) : null}
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
                      {showResults
                        ? "결과 접기"
                        : `결과 ${channel.results.length - 3}건 더 보기`}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {channel.systemStatus === "FAIL" &&
              channel.failureMessage?.includes("결과가 없습니다") ? (
                <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <p>현재 질문으로 검색된 결과가 없습니다. 질문을 바꿔 다시 검색해 보세요.</p>
                </div>
              ) : null}

              {channel.confirmation?.status === "CONFIRMED" && !confirmBlockedByStale ? (
                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                  품질 확인 완료
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

              {channel.confirmation?.status === "REJECTED" && !confirmBlockedByStale ? (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                  보완 필요
                  {channel.confirmation.rejectionReason
                    ? ` · ${channel.confirmation.rejectionReason}`
                    : ""}
                  . 검색데이터를 보완하거나 다른 질문으로 다시 확인하세요.
                </p>
              ) : null}

              {confirmBlockedByStale && channel.channel !== "DOWNLOAD" ? (
                <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                  품질 확인 대기
                  <br />
                  현재 정책으로 다시 검색한 후 확인할 수 있습니다.
                </p>
              ) : null}

              {!hideRetrievalConfirm &&
              channel.channel !== "DOWNLOAD" &&
              !confirmBlockedByStale ? (
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

              {canRun && channel.channel === "DOWNLOAD" ? (
                <button
                  type="button"
                  disabled={runningChannel === channel.channel}
                  onClick={() => void handleRun("DOWNLOAD")}
                  className="mt-3 min-h-[44px] rounded-xl border border-store-border bg-white px-3 text-sm font-semibold text-slate-800 disabled:opacity-60"
                >
                  {runningChannel === "DOWNLOAD"
                    ? "패키지 생성·검증 중..."
                    : channel.systemStatus === "PASS" || channel.systemStatus === "STALE"
                      ? "RAG Export 다시 검증"
                      : "RAG Export 검증 실행"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      ) : null}

      {searchReady && selected.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          API·MCP·RAG Export 검증 채널을 준비 중입니다.
        </p>
      ) : null}

      {preparationPassed && searchReady ? (
        <div className="space-y-2">
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            자동 평가와 제공자 품질 확인이 완료되었습니다.
          </p>
          <button
            type="button"
            onClick={() => goToDistributionReview?.()}
            className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
          >
            유통·검수 단계로 이동
          </button>
        </div>
      ) : null}
    </section>
  );
}
