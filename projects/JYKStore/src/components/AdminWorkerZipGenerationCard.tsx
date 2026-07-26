"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelAdminWorkerZipRejection,
  fetchAdminReviewDetail,
  fetchAdminWorkerZipRequestState,
  fetchAdminWorkerZipStatus,
  rejectAdminWorkerZipRequest,
  runAdminWorkerZipGeneration,
  runAdminWorkerZipQualityRefresh,
  type AdminWorkerZipGenerationResult,
  type AdminWorkerZipQualityRefreshResult,
  type AdminWorkerZipRequestState,
  type AdminWorkerZipStatus,
} from "@/lib/admin-review-api";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { AdminReviewWarningIssuesTab } from "@/components/AdminReviewWarningIssuesTab";
import { AdminWorkerZipRunsPanel } from "@/components/AdminWorkerZipRunsPanel";
import { buildQualityCheckHistoryMarkdown } from "@/lib/quality-check-history-markdown";
import {
  formatDurationMs,
  WORKER_ZIP_UI_STEP_ORDER,
  workerZipStepIndex,
} from "@/lib/worker-zip-step-labels";

const STATUS_POLL_INTERVAL_MS = 2500;
const RUNS_REFRESH_INTERVAL_MS = 30_000;
/** Heuristic advance while the blocking quality-refresh POST is in flight. */
const QUALITY_STEP_TICK_MS = 6_000;

const QUALITY_PIPELINE_STEPS = [
  { id: "source_validation", label: "원천 검증" },
  { id: "structure_quality", label: "구조/품질" },
  { id: "chunk_quality", label: "청킹 품질" },
  { id: "retrieval_cases", label: "검색 케이스" },
  { id: "retrieval_evaluation", label: "검색 평가" },
  { id: "release_gate", label: "릴리스 게이트" },
] as const;

/**
 * P7.3/P7.5: Admin "지식데이터 생성 실행" area — the execution authority for the ZIP
 * path. The Provider only submits a ZIP request; the Admin 접수 / 반려 / 실행 here.
 *
 * P7.5 adds: 자료 반려(사유 입력), a live step-progress stepper polled while the run
 * is in flight, and a Worker 작업 내역 panel. The pack stays DRAFT throughout;
 * promotion to review is a separate admin step after verification.
 */
export function AdminWorkerZipGenerationCard({
  packId,
  onReviewDetailRefresh,
  onPhaseChange,
  qualityRefreshRequestKey = 0,
  preferQualitySection = false,
}: {
  readonly packId: string;
  readonly onReviewDetailRefresh?: () => void | Promise<void>;
  readonly onPhaseChange?: (
    phase:
      | "NONE"
      | "REQUESTED"
      | "ACCEPTED"
      | "REJECTED"
      | "PROCESSING"
      | "COMPLETED"
      | "FAILED",
  ) => void;
  /** Bump to trigger a quality refresh from a parent next-action CTA. */
  readonly qualityRefreshRequestKey?: number;
  readonly preferQualitySection?: boolean;
}) {
  const [state, setState] = useState<AdminWorkerZipRequestState | null>(null);
  const [running, setRunning] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [cancellingRejection, setCancellingRejection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminWorkerZipGenerationResult | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [liveStatus, setLiveStatus] = useState<AdminWorkerZipStatus | null>(null);
  const [runsRefreshKey, setRunsRefreshKey] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [qualityRefreshing, setQualityRefreshing] = useState(false);
  const [qualityResult, setQualityResult] = useState<AdminWorkerZipQualityRefreshResult | null>(null);
  const [qualityActiveIndex, setQualityActiveIndex] = useState(0);
  const [qualityStartedAt, setQualityStartedAt] = useState<number | null>(null);
  const [evidenceDetail, setEvidenceDetail] = useState<AdminReviewDetailDto | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runsRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (runsRefreshRef.current) {
      clearInterval(runsRefreshRef.current);
      runsRefreshRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const loadState = useCallback(async () => {
    try {
      const next = await fetchAdminWorkerZipRequestState(packId);
      setState(next);
      onPhaseChange?.(next.requestStatus);
    } catch {
      setState(null);
      onPhaseChange?.("NONE");
    }
  }, [packId, onPhaseChange]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (state?.requestStatus) onPhaseChange?.(state.requestStatus);
  }, [state?.requestStatus, onPhaseChange]);

  useEffect(() => {
    if (!preferQualitySection) return;
    const el = document.getElementById("admin-quality-section");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [preferQualitySection]);

  const onReject = async () => {
    if (rejecting || running) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError("반려 사유를 입력해 주세요.");
      return;
    }
    setRejecting(true);
    setError(null);
    try {
      await rejectAdminWorkerZipRequest(packId, reason);
      setShowRejectForm(false);
      setRejectReason("");
      await loadState();
      setRunsRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "반려에 실패했습니다.");
    } finally {
      setRejecting(false);
    }
  };

  const onCancelRejection = async () => {
    if (cancellingRejection || running || rejecting) return;
    setCancellingRejection(true);
    setError(null);
    try {
      await cancelAdminWorkerZipRejection(packId);
      await loadState();
      setRunsRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "반려 취소에 실패했습니다.");
    } finally {
      setCancellingRejection(false);
    }
  };

  const onExecute = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setLiveStatus(null);
    setNowTick(Date.now());

    // Poll the status API concurrently with the (synchronous) POST so the stepper
    // advances live while the run is in flight. Cleared once the POST resolves.
    const poll = async () => {
      try {
        setLiveStatus(await fetchAdminWorkerZipStatus(packId));
      } catch {
        // transient; keep the last snapshot
      }
    };
    void poll();
    pollRef.current = setInterval(() => void poll(), STATUS_POLL_INTERVAL_MS);
    tickRef.current = setInterval(() => setNowTick(Date.now()), 1000);
    // Keep Worker 작업 내역 in sync while the (long) generation POST is in flight.
    setRunsRefreshKey((k) => k + 1);
    runsRefreshRef.current = setInterval(() => {
      setRunsRefreshKey((k) => k + 1);
    }, RUNS_REFRESH_INTERVAL_MS);

    try {
      const res = await runAdminWorkerZipGeneration(packId);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "지식데이터 생성 실행에 실패했습니다.");
    } finally {
      stopPolling();
      await poll();
      await loadState();
      setRunsRefreshKey((k) => k + 1);
      setRunning(false);
    }
  };

  const onQualityRefresh = async () => {
    if (qualityRefreshing || running) return;
    setQualityRefreshing(true);
    setError(null);
    setEvidenceError(null);
    setQualityActiveIndex(0);
    setQualityStartedAt(Date.now());
    try {
      const res = await runAdminWorkerZipQualityRefresh(packId);
      setQualityResult(res);
      setEvidenceLoading(true);
      try {
        const data = await fetchAdminReviewDetail(packId);
        setEvidenceDetail(data.detail);
      } catch (err) {
        setEvidenceError(err instanceof Error ? err.message : "품질 점검 결과를 불러오지 못했습니다.");
      } finally {
        setEvidenceLoading(false);
      }
      void onReviewDetailRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "품질 점검에 실패했습니다.");
    } finally {
      setQualityRefreshing(false);
      setQualityStartedAt(null);
    }
  };

  const qualityRefreshKeyRef = useRef(0);
  useEffect(() => {
    if (!qualityRefreshRequestKey || qualityRefreshRequestKey === qualityRefreshKeyRef.current) {
      return;
    }
    qualityRefreshKeyRef.current = qualityRefreshRequestKey;
    void onQualityRefresh();
    // Intentionally only react to the parent request key.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onQualityRefresh closes over latest state
  }, [qualityRefreshRequestKey]);

  const reloadEvidenceDetail = async () => {
    setEvidenceLoading(true);
    setEvidenceError(null);
    try {
      const data = await fetchAdminReviewDetail(packId);
      setEvidenceDetail(data.detail);
      setQualityResult((prev) => prev ?? buildQualitySnapshotFromDetail(data.detail, packId));
      void onReviewDetailRefresh?.();
    } catch (err) {
      setEvidenceError(err instanceof Error ? err.message : "품질 점검 결과를 불러오지 못했습니다.");
      setEvidenceDetail(null);
    } finally {
      setEvidenceLoading(false);
    }
  };

  useEffect(() => {
    if (!qualityRefreshing) return;
    setNowTick(Date.now());
    const tickId = setInterval(() => setNowTick(Date.now()), 1000);
    const stepId = setInterval(() => {
      setQualityActiveIndex((i) => Math.min(i + 1, QUALITY_PIPELINE_STEPS.length - 1));
    }, QUALITY_STEP_TICK_MS);
    return () => {
      clearInterval(tickId);
      clearInterval(stepId);
    };
  }, [qualityRefreshing]);

  const request = state?.request ?? null;
  const hasRequest = Boolean(request);
  const status = state?.requestStatus ?? "NONE";
  const inProgress = status === "PROCESSING" || running;
  const isAccepted = status === "ACCEPTED";
  const isRejected = status === "REJECTED";
  const canAccept = status === "REQUESTED";
  const canReject =
    (status === "REQUESTED" ||
      status === "ACCEPTED" ||
      status === "COMPLETED" ||
      status === "FAILED") &&
    !running &&
    !inProgress;
  const rejection = request?.rejection ?? null;
  const canCancelRejection =
    isRejected && Boolean(rejection) && !rejection?.acknowledgedAt && !running && !inProgress;
  const completed = result?.ok === true && result.generationReady === true;
  const failed = result != null && result.ok === false;
  const generationDone = completed || status === "COMPLETED";
  const canQualityRefresh = generationDone && !running && !qualityRefreshing;

  useEffect(() => {
    if (!generationDone || qualityRefreshing) return;
    let cancelled = false;
    void (async () => {
      setEvidenceLoading(true);
      setEvidenceError(null);
      try {
        const data = await fetchAdminReviewDetail(packId);
        if (cancelled) return;
        setEvidenceDetail(data.detail);
        setQualityResult((prev) => prev ?? buildQualitySnapshotFromDetail(data.detail, packId));
      } catch (err) {
        if (cancelled) return;
        setEvidenceError(err instanceof Error ? err.message : "품질 점검 결과를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setEvidenceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generationDone, packId, qualityRefreshing]);

  return (
    <div className="space-y-3">
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-900">지식데이터 생성 실행</h2>
          <p className="text-xs text-slate-600">
            제공자가 등록한 자료(ZIP)를 확인한 뒤 지식데이터 생성을 실행합니다. 자료에 문제가 있으면
            사유를 남겨 반려할 수 있습니다. 생성·검증이 끝나면 검수 단계로 승격하세요.
          </p>
        </div>

        {hasRequest ? (
          <dl className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">첨부 자료</dt>
              <dd className="font-medium text-slate-900">{request!.originalFileName}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">파일 크기</dt>
              <dd>{formatBytes(request!.fileSize)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">요청 일시</dt>
              <dd>{formatDateTime(request!.uploadedAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">요청 상태</dt>
              <dd className="font-semibold text-slate-900">{statusLabel(state!.requestStatus)}</dd>
            </div>
          </dl>
        ) : (
          <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            아직 접수된 생성 요청(ZIP 자료)이 없습니다. 제공자에게 자료 등록을 요청하세요.
          </p>
        )}

        {isRejected ? (
          <div className="space-y-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
            <p className="font-semibold">이 요청은 반려되었습니다.</p>
            {rejection?.reason ? (
              <p className="whitespace-pre-wrap rounded-lg bg-white/70 px-2 py-1 text-red-900">
                사유: {rejection.reason}
              </p>
            ) : null}
            {rejection?.acknowledgedAt ? (
              <p className="text-[11px] text-red-700">
                제공자가 반려 사유를 확인했습니다. ({formatDateTime(rejection.acknowledgedAt)})
              </p>
            ) : (
              <p className="text-[11px] text-red-700">
                제공자가 반려 사유를 확인하기 전에는 반려를 취소할 수 있습니다.
              </p>
            )}
            {canCancelRejection ? (
              <button
                type="button"
                onClick={() => void onCancelRejection()}
                disabled={cancellingRejection}
                className="min-h-[36px] w-full rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 disabled:opacity-60"
              >
                {cancellingRejection ? "반려 취소 중…" : "반려 취소"}
              </button>
            ) : null}
          </div>
        ) : null}

        {canAccept ? (
          <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-950">
            아직 자료 접수가 되지 않았습니다.{" "}
            <a
              href={`/admin/reviews/${encodeURIComponent(packId)}?step=queue`}
              className="font-semibold underline"
            >
              자료 접수
            </a>{" "}
            단계에서 먼저 접수하세요. 이 단계에서는 생성 실행만 진행합니다.
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void onExecute()}
            disabled={running || !hasRequest || inProgress || canAccept || isRejected}
            className="min-h-[44px] flex-1 rounded-xl bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {running ? "생성 실행 중…" : "지식데이터 생성 실행"}
          </button>
          {canReject && !canAccept ? (
            <button
              type="button"
              onClick={() => {
                setShowRejectForm((v) => !v);
                setError(null);
              }}
              disabled={rejecting || running}
              className="min-h-[44px] rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 disabled:opacity-60"
            >
              자료 반려
            </button>
          ) : null}
        </div>

        {showRejectForm && canReject ? (
          <div className="space-y-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2">
            <p className="text-xs font-semibold text-red-900">생성 요청 반려</p>
            <p className="text-[11px] text-red-800">
              제공자가 ZIP을 수정해 다시 요청할 수 있도록 반려 사유를 입력해 주세요.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="예: 구조화 대상 문서가 부족합니다. 매뉴얼/샘플 문서를 포함해 다시 요청해 주세요."
              className="w-full rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-slate-800"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void onReject()}
                disabled={rejecting || !rejectReason.trim()}
                className="min-h-[36px] flex-1 rounded-xl bg-red-600 px-3 text-xs font-bold text-white disabled:opacity-60"
              >
                {rejecting ? "반려 처리 중…" : "반려 처리"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
                disabled={rejecting}
                className="min-h-[36px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 disabled:opacity-60"
              >
                취소
              </button>
            </div>
          </div>
        ) : null}

        {isAccepted ? (
          <p className="text-[11px] text-indigo-700">접수완료 — 제공자는 더 이상 요청을 회수할 수 없습니다.</p>
        ) : null}

        {running ? <GenerationProgress status={liveStatus} nowMs={nowTick} /> : null}

        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {completed ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <p className="font-semibold">지식데이터 생성이 완료되었습니다.</p>
            <p className="text-xs">
              지식 청크 {result!.importedChunkCount}개 · 검색데이터 {result!.importedEmbeddingCount}개
            </p>
            <p className="mt-1 text-[11px] text-emerald-800">
              Worker 작업 내역을 확인한 뒤, 아래 품질 점검을 실행해 주세요.
            </p>
          </div>
        ) : null}

        {failed ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p>{result!.error?.message ?? "지식데이터 생성에 실패했습니다."}</p>
          </div>
        ) : null}

        {result?.exclusionSummary && result.exclusionSummary.total > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">
              자동 제외된 파일 {result.exclusionSummary.total}개
            </p>
            <p className="mt-0.5 text-slate-500">
              보안 차단 및 기본 제외 정책으로 구조화 대상에서 제외되었습니다. 원본 자료는 그대로 보존됩니다.
            </p>
            <ul className="mt-1 space-y-0.5">
              {topExclusionReasons(result.exclusionSummary.byReason).map(([reason, count]) => (
                <li key={reason} className="flex justify-between gap-2">
                  <span className="text-slate-600">{exclusionReasonLabel(reason)}</span>
                  <span className="font-medium text-slate-900">{count}개</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {result ? (
          <div className="text-xs">
            <button
              type="button"
              onClick={() => setShowDebug((v) => !v)}
              className="text-slate-500 underline"
            >
              {showDebug ? "디버그 정보 숨기기" : "디버그 정보 보기"}
            </button>
            {showDebug ? (
              <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-2 text-[11px] text-slate-100">
{JSON.stringify(
  {
    pipelineRunId: result.pipelineRunId,
    generationReady: result.generationReady,
    nextStep: result.nextStep,
    pgvectorReflected: result.pgvectorReflected,
    warnings: result.warnings,
    error: result.error,
  },
  null,
  2,
)}
              </pre>
            ) : null}
          </div>
        ) : null}
      </section>

      <AdminWorkerZipRunsPanel packId={packId} refreshKey={runsRefreshKey} />

      {generationDone ? (
        <section
          id="admin-quality-section"
          className="scroll-mt-24 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
        >
          <p className="text-sm font-bold text-slate-900">품질 점검</p>
          <p className="text-xs text-slate-600">
            원천 문서 검증 → 구조/품질 → 청킹 품질 → 검색 품질 평가를 실제 데이터로 실행합니다.
            결과는 아래 품질 점검 결과에 반영됩니다.
            자료가 크면 수 분이 걸릴 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => void onQualityRefresh()}
            disabled={!canQualityRefresh}
            className="min-h-[40px] w-full rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {qualityRefreshing ? "품질 점검 실행 중…" : "품질 점검 실행"}
          </button>

          {qualityRefreshing ? (
            <QualityPipelineProgress
              mode="running"
              activeIndex={qualityActiveIndex}
              startedAtMs={qualityStartedAt}
              nowMs={nowTick}
            />
          ) : null}

          {!qualityRefreshing && !qualityResult && evidenceLoading ? (
            <p className="text-xs text-store-muted">저장된 품질 점검 결과를 불러오는 중…</p>
          ) : null}

          {!qualityRefreshing && !qualityResult && !evidenceLoading ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-store-muted">
              아직 표시할 품질 점검 결과가 없습니다. 실행이 끝나면 이 아래에 readiness와 주의 이슈가
              표시됩니다.
            </p>
          ) : null}
        </section>
      ) : null}

      {qualityResult && !qualityRefreshing ? (
        <QualityCheckHistoryCard
          packId={packId}
          qualityResult={qualityResult}
          detail={evidenceDetail}
          loading={evidenceLoading}
          error={evidenceError}
          onRetry={() => void reloadEvidenceDetail()}
        />
      ) : null}
    </div>
  );
}

/** Live step-progress stepper driven by the polled status snapshot. */
function GenerationProgress({
  status,
  nowMs,
}: {
  readonly status: AdminWorkerZipStatus | null;
  readonly nowMs: number;
}) {
  const run = status?.run ?? null;
  const currentIndex = workerZipStepIndex(run?.currentStep ?? null);
  const startedMs = run?.startedAt ? new Date(run.startedAt).getTime() : null;
  const elapsedMs = startedMs != null ? Math.max(0, nowMs - startedMs) : null;

  return (
    <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-3">
      <p className="text-xs font-semibold text-indigo-900">지식데이터 생성 실행 중</p>
      <ol className="flex flex-wrap gap-1.5">
        {WORKER_ZIP_UI_STEP_ORDER.map((s, idx) => {
          const done = currentIndex >= 0 && idx < currentIndex;
          const active = currentIndex >= 0 && idx === currentIndex;
          return (
            <li
              key={s.step}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                active
                  ? "bg-indigo-600 text-white"
                  : done
                    ? "bg-indigo-200 text-indigo-900"
                    : "bg-white text-slate-400 ring-1 ring-inset ring-slate-200"
              }`}
            >
              {done ? "✓ " : ""}
              {s.label}
            </li>
          );
        })}
      </ol>
      <dl className="space-y-0.5 text-[11px] text-slate-600">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">현재 단계</dt>
          <dd className="font-medium text-slate-900">{run?.currentStepLabel || "준비 중"}</dd>
        </div>
        {run?.message ? (
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">처리 메시지</dt>
            <dd className="text-slate-700">{run.message}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">경과 시간</dt>
          <dd className="font-medium text-slate-900">
            {elapsedMs != null ? formatDurationMs(elapsedMs) : "00:00"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function QualityPipelineProgress({
  mode,
  activeIndex = 0,
  stepsCompleted = [],
  stoppedAt = null,
  startedAtMs = null,
  nowMs = Date.now(),
}: {
  readonly mode: "running" | "done";
  readonly activeIndex?: number;
  readonly stepsCompleted?: readonly string[];
  readonly stoppedAt?: string | null;
  readonly startedAtMs?: number | null;
  readonly nowMs?: number;
}) {
  const completedSet = new Set(stepsCompleted);
  const stoppedIndex = stoppedAt
    ? QUALITY_PIPELINE_STEPS.findIndex((s) => s.id === stoppedAt)
    : -1;
  const elapsedMs =
    mode === "running" && startedAtMs != null ? Math.max(0, nowMs - startedAtMs) : null;

  return (
    <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-3">
      <p className="text-xs font-semibold text-violet-900">
        {mode === "running" ? "품질 점검 파이프라인 진행 중" : "품질 점검 파이프라인 결과"}
      </p>
      <ol className="flex flex-wrap gap-1.5">
        {QUALITY_PIPELINE_STEPS.map((s, idx) => {
          let done = false;
          let active = false;
          let failed = false;
          if (mode === "running") {
            done = idx < activeIndex;
            active = idx === activeIndex;
          } else {
            done = completedSet.has(s.id);
            failed = stoppedIndex === idx;
            active = false;
          }
          return (
            <li
              key={s.id}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                failed
                  ? "bg-red-600 text-white"
                  : active
                    ? "bg-violet-600 text-white animate-pulse"
                    : done
                      ? "bg-violet-200 text-violet-900"
                      : "bg-white text-slate-400 ring-1 ring-inset ring-slate-200"
              }`}
            >
              {failed ? "✕ " : done ? "✓ " : ""}
              {s.label}
            </li>
          );
        })}
      </ol>
      {mode === "running" ? (
        <dl className="space-y-0.5 text-[11px] text-slate-600">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">추정 단계</dt>
            <dd className="font-medium text-slate-900">
              {QUALITY_PIPELINE_STEPS[activeIndex]?.label ?? "준비 중"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">경과 시간</dt>
            <dd className="font-medium text-slate-900">
              {elapsedMs != null ? formatDurationMs(elapsedMs) : "00:00"}
            </dd>
          </div>
          <p className="pt-0.5 text-[10px] text-slate-500">
            서버는 전체 파이프라인 완료 후 결과를 반환합니다. 단계 표시는 진행 안내용입니다.
          </p>
        </dl>
      ) : null}
    </div>
  );
}

function QualityCheckHistoryCard({
  packId,
  qualityResult,
  detail,
  loading,
  error,
  onRetry,
}: {
  readonly packId: string;
  readonly qualityResult: AdminWorkerZipQualityRefreshResult;
  readonly detail: AdminReviewDetailDto | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const readiness = qualityResult.readiness;

  const onDownloadMarkdown = useCallback(() => {
    const markdown = buildQualityCheckHistoryMarkdown({
      packId,
      qualityResult,
      detail,
    });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadTextFile(`quality-check-${packId}-${stamp}.md`, markdown);
  }, [packId, qualityResult, detail]);

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-expanded={!collapsed}
              className="flex items-center gap-1.5 text-sm font-bold text-slate-900"
            >
              <span
                aria-hidden
                className={`text-slate-400 transition-transform ${collapsed ? "" : "rotate-90"}`}
              >
                ▸
              </span>
              품질 점검 결과
            </button>
            <button
              type="button"
              onClick={onRetry}
              disabled={loading}
              title="새로고침"
              aria-label="새로고침"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
            >
              <RefreshIcon spinning={loading} />
            </button>
            <button
              type="button"
              onClick={onDownloadMarkdown}
              title="점검내역 MD 다운로드"
              aria-label="점검내역 MD 다운로드"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <DownloadIcon />
            </button>
          </div>
          {!collapsed ? (
            <p className="mt-0.5 text-xs text-store-muted">
              최근 품질 점검의 파이프라인 결과, readiness 요약, 차단/주의 이슈입니다.
            </p>
          ) : null}
        </div>
      </div>

      {collapsed ? null : (
        <>
          <div className="space-y-2 rounded-lg border border-indigo-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
            <p className="font-semibold text-slate-900">
              점검 완료
              {qualityResult.stoppedAt ? ` (중단: ${qualityResult.stoppedAt})` : ""}
            </p>
            <QualityPipelineProgress
              mode="done"
              stepsCompleted={qualityResult.stepsCompleted}
              stoppedAt={qualityResult.stoppedAt}
            />
            {(qualityResult.backfilledSourceDocuments > 0 ||
              qualityResult.retypedSourceDocuments > 0) && (
              <p className="mt-0.5">
                {qualityResult.backfilledSourceDocuments > 0
                  ? `원천 본문 보완 ${qualityResult.backfilledSourceDocuments}건`
                  : ""}
                {qualityResult.backfilledSourceDocuments > 0 &&
                qualityResult.retypedSourceDocuments > 0
                  ? " · "
                  : ""}
                {qualityResult.retypedSourceDocuments > 0
                  ? `자료 유형 재분류 ${qualityResult.retypedSourceDocuments}건`
                  : ""}
              </p>
            )}
            {qualityResult.warnings.length > 0 ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-800">
                {qualityResult.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-emerald-800">경고 없이 파이프라인을 마쳤습니다.</p>
            )}
          </div>

          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700 sm:grid-cols-2">
            <p>
              원천 검증: PASS {readiness.sourceValidation.passCount} · WARNING{" "}
              {readiness.sourceValidation.warningCount} · FAIL {readiness.sourceValidation.failCount}
            </p>
            <p>구조 커버리지: {readiness.structureCoverageStatus ?? "-"}</p>
            <p>지식 품질: {readiness.knowledgeQualityStatus ?? "-"}</p>
            <p>청킹 품질: {readiness.chunkQualityStatus ?? "-"}</p>
            <p>검색 평가: {readiness.retrievalEvaluationStatus ?? "-"}</p>
            <p>릴리스 게이트: {readiness.releaseGateStatus ?? "-"}</p>
            {readiness.structureQualityMessage ? (
              <p className="sm:col-span-2 text-slate-600">{readiness.structureQualityMessage}</p>
            ) : null}
            {readiness.chunkQualityMessage ? (
              <p className="sm:col-span-2 text-slate-600">{readiness.chunkQualityMessage}</p>
            ) : null}
            {readiness.retrievalEvaluationMessage ? (
              <p className="sm:col-span-2 text-slate-600">{readiness.retrievalEvaluationMessage}</p>
            ) : null}
            {readiness.releaseGateMessage ? (
              <p className="sm:col-span-2 text-slate-600">{readiness.releaseGateMessage}</p>
            ) : null}
          </div>

          {loading ? (
            <p className="text-sm text-store-muted">품질 점검 결과를 불러오는 중…</p>
          ) : error ? (
            <div className="space-y-2">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                다시 불러오기
              </button>
            </div>
          ) : detail ? (
            <AdminReviewWarningIssuesTab detail={detail} />
          ) : (
            <p className="text-sm text-store-muted">표시할 품질 점검 결과가 없습니다.</p>
          )}
        </>
      )}
    </section>
  );
}

/** Rebuild a quality-refresh result snapshot from persisted review readiness. */
function buildQualitySnapshotFromDetail(
  detail: AdminReviewDetailDto,
  packId: string,
): AdminWorkerZipQualityRefreshResult | null {
  const r = detail.readiness;
  const sv = r.sourceValidation;
  const checked = sv.passCount + sv.warningCount + sv.failCount;
  const hasAny =
    checked > 0 ||
    r.structureCoverageStatus != null ||
    r.chunkQualityStatus != null ||
    r.retrievalEvaluationStatus != null ||
    r.releaseGateStatus != null;
  if (!hasAny) return null;

  const stepsCompleted: string[] = [];
  if (checked > 0) stepsCompleted.push("source_validation");
  if (r.structureCoverageStatus != null || r.knowledgeQualityStatus != null) {
    stepsCompleted.push("structure_quality");
  }
  if (r.chunkQualityStatus != null) stepsCompleted.push("chunk_quality");
  if (r.retrievalEvaluationStatus != null) {
    stepsCompleted.push("retrieval_cases", "retrieval_evaluation");
  }
  if (r.releaseGateStatus != null) stepsCompleted.push("release_gate");

  return {
    ok: true,
    clientId: "",
    packId,
    backfilledSourceDocuments: 0,
    retypedSourceDocuments: 0,
    stepsCompleted,
    warnings: [],
    stoppedAt: null,
    readiness: {
      sourceValidation: {
        passCount: sv.passCount,
        warningCount: sv.warningCount,
        failCount: sv.failCount,
        notCheckedCount: sv.notCheckedCount,
      },
      structureCoverageStatus: r.structureCoverageStatus,
      knowledgeQualityStatus: r.knowledgeQualityStatus,
      structureQualityMessage: r.structureQualityMessage,
      chunkQualityStatus: r.chunkQualityStatus,
      chunkQualityMessage: r.chunkQualityMessage,
      retrievalEvaluationStatus: r.retrievalEvaluationStatus,
      retrievalEvaluationMessage: r.retrievalEvaluationMessage,
      releaseGateStatus: r.releaseGateStatus,
      releaseGateMessage: r.releaseGateMessage,
    },
  };
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 14.5V16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon({ spinning = false }: { readonly spinning?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16.5 10a6.5 6.5 0 1 1-1.7-4.4M16.5 3.5V7H13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function downloadTextFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function statusLabel(status: AdminWorkerZipRequestState["requestStatus"]): string {
  switch (status) {
    case "REQUESTED":
      return "접수 대기";
    case "ACCEPTED":
      return "접수완료";
    case "REJECTED":
      return "반려됨";
    case "PROCESSING":
      return "생성 실행 중";
    case "COMPLETED":
      return "생성 완료";
    case "FAILED":
      return "생성 실패";
    default:
      return "대기";
  }
}

/** Top exclusion reasons by count (descending), capped for a compact read-only view. */
function topExclusionReasons(byReason: Record<string, number>, limit = 5): [string, number][] {
  return Object.entries(byReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function exclusionReasonLabel(reason: string): string {
  switch (reason) {
    case "blocked_path_traversal":
      return "보안 차단: 잘못된 경로";
    case "blocked_absolute_path":
      return "보안 차단: 절대경로";
    case "blocked_symlink":
      return "보안 차단: 심볼릭 링크";
    case "excluded_directory":
      return "제외 폴더 (빌드/캐시 등)";
    case "excluded_file_name":
      return "제외 파일명 (시스템 파일 등)";
    case "excluded_extension":
      return "제외 확장자 (실행/압축 파일 등)";
    case "file_size_exceeded":
      return "용량 초과 파일";
    case "unsupported_entry_type":
      return "처리할 수 없는 항목";
    default:
      return reason;
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** idx;
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}
