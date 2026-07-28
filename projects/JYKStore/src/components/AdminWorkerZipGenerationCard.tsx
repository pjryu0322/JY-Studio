"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAdminReviewDetail,
  fetchAdminWorkerZipRequestState,
  fetchAdminWorkerZipStatus,
  runAdminWorkerZipGeneration,
  type AdminWorkerZipGenerationResult,
  type AdminWorkerZipQualityRefreshResult,
  type AdminWorkerZipRequestState,
  type AdminWorkerZipStatus,
} from "@/lib/admin-review-api";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  clearQualityRefreshSessionJob,
  getQualityRefreshSessionJob,
  isQualityRefreshSessionRunning,
  qualityRefreshProgressIndex,
  startQualityRefreshSessionJob,
} from "@/lib/admin-worker-zip-quality-refresh-session";
import {
  clearAdminQualityReviewAcknowledged,
  isAdminQualityReviewAcknowledged,
  setAdminQualityReviewAcknowledged,
} from "@/lib/admin-quality-review-ack-session";
import { AdminReviewWarningIssuesTab } from "@/components/AdminReviewWarningIssuesTab";
import {
  AdminPanelCollapseIcon,
  AdminPanelDownloadIcon,
  AdminPanelIconButton,
  AdminPanelRefreshIcon,
} from "@/components/AdminPanelToolbarIcons";
import { AdminWorkerZipRunsPanel } from "@/components/AdminWorkerZipRunsPanel";
import { buildQualityCheckHistoryMarkdown } from "@/lib/quality-check-history-markdown";
import { buildAdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
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
 * Workbench — 지식데이터 생성 실행 및/또는 품질점검.
 * 자료 접수/반려는 AdminMaterialAcceptancePanel(queue)에서 처리한다.
 */
export function AdminWorkerZipGenerationCard({
  packId,
  onReviewDetailRefresh,
  onPhaseChange,
  qualityRefreshRequestKey = 0,
  qualityResultsRevealKey = 0,
  preferQualitySection = false,
  workbenchMode = "all",
  autoStartGeneration = false,
  onAutoStartGenerationConsumed,
  onGoQuality: _onGoQuality,
  onGoCorrection,
  onGoProviderReview,
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
  /** Bump to expand + scroll to 품질 점검 결과 (e.g. 「상세 결과로 이동」). */
  readonly qualityResultsRevealKey?: number;
  readonly preferQualitySection?: boolean;
  /** generation = Worker only; quality = quality only; all = legacy combined. */
  readonly workbenchMode?: "generation" | "quality" | "all";
  /** Start Worker generation once when the request is ready. */
  readonly autoStartGeneration?: boolean;
  readonly onAutoStartGenerationConsumed?: () => void;
  readonly onGoQuality?: () => void;
  readonly onGoCorrection?: () => void;
  readonly onGoProviderReview?: () => void;
}) {
  const [state, setState] = useState<AdminWorkerZipRequestState | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminWorkerZipGenerationResult | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [liveStatus, setLiveStatus] = useState<AdminWorkerZipStatus | null>(null);
  const [runsRefreshKey, setRunsRefreshKey] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [qualityRefreshing, setQualityRefreshing] = useState(() =>
    isQualityRefreshSessionRunning(packId),
  );
  const [qualityResult, setQualityResult] = useState<AdminWorkerZipQualityRefreshResult | null>(
    () => {
      const job = getQualityRefreshSessionJob(packId);
      return job?.status === "done" ? job.result : null;
    },
  );
  const [qualityActiveIndex, setQualityActiveIndex] = useState(() => {
    const job = getQualityRefreshSessionJob(packId);
    if (job?.status !== "running") return 0;
    return qualityRefreshProgressIndex(
      job.startedAt,
      Date.now(),
      QUALITY_PIPELINE_STEPS.length,
      QUALITY_STEP_TICK_MS,
    );
  });
  const [qualityStartedAt, setQualityStartedAt] = useState<number | null>(() => {
    const job = getQualityRefreshSessionJob(packId);
    return job?.status === "running" ? job.startedAt : null;
  });
  const [evidenceDetail, setEvidenceDetail] = useState<AdminReviewDetailDto | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [generationCollapsed, setGenerationCollapsed] = useState(false);
  const [qualityCollapsed, setQualityCollapsed] = useState(false);
  const [qualityReviewAcknowledged, setQualityReviewAcknowledged] = useState(() =>
    isAdminQualityReviewAcknowledged(packId),
  );
  const packIdRef = useRef(packId);
  packIdRef.current = packId;
  const loadEvidenceForPackRef = useRef<
    (targetPackId: string) => Promise<AdminReviewDetailDto | null>
  >(async () => null);
  const applyQualityRefreshResultRef = useRef<
    (targetPackId: string, res: AdminWorkerZipQualityRefreshResult) => Promise<void>
  >(async () => undefined);

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
    setEvidenceDetail(null);
    setEvidenceError(null);
    setResult(null);
    setError(null);
    setQualityReviewAcknowledged(isAdminQualityReviewAcknowledged(packId));
    const job = getQualityRefreshSessionJob(packId);
    if (job?.status === "running") {
      setQualityRefreshing(true);
      setQualityStartedAt(job.startedAt);
      setQualityActiveIndex(
        qualityRefreshProgressIndex(
          job.startedAt,
          Date.now(),
          QUALITY_PIPELINE_STEPS.length,
          QUALITY_STEP_TICK_MS,
        ),
      );
      setQualityResult(null);
    } else if (job?.status === "done") {
      setQualityRefreshing(false);
      setQualityStartedAt(null);
      setQualityActiveIndex(0);
      setQualityResult(job.result);
    } else {
      setQualityRefreshing(false);
      setQualityStartedAt(null);
      setQualityActiveIndex(0);
      setQualityResult(null);
      if (job?.status === "error") setError(job.message);
    }
  }, [packId]);

  useEffect(() => {
    if (state?.requestStatus) onPhaseChange?.(state.requestStatus);
  }, [state?.requestStatus, onPhaseChange]);

  useEffect(() => {
    if (!preferQualitySection && !qualityResultsRevealKey) return;
    const targetId = qualityResult
      ? "admin-quality-results"
      : "admin-quality-section";
    const el = document.getElementById(targetId);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [preferQualitySection, qualityResultsRevealKey, qualityResult]);

  const loadEvidenceForPack = useCallback(async (targetPackId: string) => {
    setEvidenceLoading(true);
    setEvidenceError(null);
    try {
      const data = await fetchAdminReviewDetail(targetPackId);
      if (packIdRef.current !== targetPackId) return null;
      setEvidenceDetail(data.detail);
      return data.detail;
    } catch (err) {
      if (packIdRef.current !== targetPackId) return null;
      setEvidenceError(
        err instanceof Error ? err.message : "품질 점검 결과를 불러오지 못했습니다.",
      );
      setEvidenceDetail(null);
      return null;
    } finally {
      if (packIdRef.current === targetPackId) setEvidenceLoading(false);
    }
  }, []);

  const applyQualityRefreshResult = useCallback(
    async (targetPackId: string, res: AdminWorkerZipQualityRefreshResult) => {
      if (packIdRef.current !== targetPackId) return;
      setQualityResult(res);
      await loadEvidenceForPack(targetPackId);
      if (packIdRef.current === targetPackId) void onReviewDetailRefresh?.();
    },
    [loadEvidenceForPack, onReviewDetailRefresh],
  );
  loadEvidenceForPackRef.current = loadEvidenceForPack;
  applyQualityRefreshResultRef.current = applyQualityRefreshResult;

  const onExecute = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setLiveStatus(null);
    setNowTick(Date.now());
    // New generation invalidates prior subsequent artifacts in the UI until re-run.
    clearQualityRefreshSessionJob(packId);
    clearAdminQualityReviewAcknowledged(packId);
    setQualityReviewAcknowledged(false);
    setQualityResult(null);
    setEvidenceDetail(null);
    setEvidenceError(null);
    setQualityRefreshing(false);
    setQualityStartedAt(null);

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
    if (
      qualityRefreshing ||
      running ||
      qualityReviewAcknowledged ||
      isQualityRefreshSessionRunning(packId)
    ) {
      return;
    }
    const targetPackId = packId;
    clearAdminQualityReviewAcknowledged(targetPackId);
    setQualityReviewAcknowledged(false);
    setQualityRefreshing(true);
    setError(null);
    setEvidenceError(null);
    setQualityResult(null);
    setEvidenceDetail(null);
    const startedAt = Date.now();
    setQualityStartedAt(startedAt);
    setQualityActiveIndex(0);
    try {
      const res = await startQualityRefreshSessionJob(targetPackId);
      await applyQualityRefreshResult(targetPackId, res);
    } catch (err) {
      if (packIdRef.current !== targetPackId) return;
      setError(err instanceof Error ? err.message : "품질 점검에 실패했습니다.");
    } finally {
      if (packIdRef.current === targetPackId) {
        setQualityRefreshing(false);
        setQualityStartedAt(null);
      }
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
    const detail = await loadEvidenceForPack(packId);
    if (!detail || packIdRef.current !== packId) return;
    const snapshot = buildQualitySnapshotFromDetail(detail, packId);
    if (snapshot) setQualityResult(snapshot);
    void onReviewDetailRefresh?.();
  };

  useEffect(() => {
    if (!qualityRefreshing || qualityStartedAt == null) return;
    setNowTick(Date.now());
    const tickId = setInterval(() => setNowTick(Date.now()), 1000);
    const stepId = setInterval(() => {
      setQualityActiveIndex(
        qualityRefreshProgressIndex(
          qualityStartedAt,
          Date.now(),
          QUALITY_PIPELINE_STEPS.length,
          QUALITY_STEP_TICK_MS,
        ),
      );
    }, 1000);
    return () => {
      clearInterval(tickId);
      clearInterval(stepId);
    };
  }, [qualityRefreshing, qualityStartedAt]);

  const request = state?.request ?? null;
  const hasRequest = Boolean(request);
  const status = state?.requestStatus ?? "NONE";
  const inProgress = status === "PROCESSING" || running;
  const isRejected = status === "REJECTED";
  const canAccept = status === "REQUESTED";
  const completed = result?.ok === true && result.generationReady === true;
  const failed = result != null && result.ok === false;
  const generationDone = completed || status === "COMPLETED";

  const autoStartedRef = useRef(false);
  const autoStartArmedRef = useRef(false);
  useEffect(() => {
    autoStartedRef.current = false;
    autoStartArmedRef.current = false;
  }, [packId]);

  // Rising edge of autoStartGeneration: allow another forced run (e.g. create icon
  // clicked again on the same pack, including after COMPLETED).
  useEffect(() => {
    if (autoStartGeneration && !autoStartArmedRef.current) {
      autoStartedRef.current = false;
    }
    autoStartArmedRef.current = autoStartGeneration;
  }, [autoStartGeneration]);

  useEffect(() => {
    if (!autoStartGeneration || workbenchMode === "quality") return;
    if (autoStartedRef.current || !state) return;
    // Force regenerate even when already COMPLETED — create icon means "run now".
    if (running || !hasRequest || inProgress || canAccept || isRejected) {
      onAutoStartGenerationConsumed?.();
      return;
    }
    autoStartedRef.current = true;
    onAutoStartGenerationConsumed?.();
    void onExecute();
    // onExecute closes over latest handlers; fire once when request state is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot auto start
  }, [
    autoStartGeneration,
    workbenchMode,
    state,
    hasRequest,
    inProgress,
    canAccept,
    isRejected,
    running,
  ]);
  const canQualityRefresh =
    generationDone && !running && !qualityRefreshing && !qualityReviewAcknowledged;
  const canAcknowledgeQualityReview =
    generationDone &&
    Boolean(qualityResult) &&
    !qualityRefreshing &&
    !qualityReviewAcknowledged;
  const canCancelQualityReviewAck = qualityReviewAcknowledged && !qualityRefreshing;

  const onAcknowledgeQualityReview = () => {
    if (!canAcknowledgeQualityReview || !qualityResult) return;
    setAdminQualityReviewAcknowledged(packId, true);
    setQualityReviewAcknowledged(true);
    const next = resolveQualityReviewCompleteDestination(qualityResult, evidenceDetail);
    if (next === "correction") onGoCorrection?.();
    else onGoProviderReview?.();
  };

  const onCancelQualityReviewAck = () => {
    if (!canCancelQualityReviewAck) return;
    clearAdminQualityReviewAcknowledged(packId);
    setQualityReviewAcknowledged(false);
  };

  const showGenerationUi = workbenchMode === "generation" || workbenchMode === "all";
  const showQualityUi = workbenchMode === "quality" || workbenchMode === "all";

  // Reattach an in-flight session job, or load persisted final readiness for this pack.
  // Dependency array length must stay fixed (HMR-safe). Callbacks are read via refs.
  useEffect(() => {
    if (!showQualityUi) return;
    let cancelled = false;
    const targetPackId = packId;

    const rehydrate = async () => {
      const job = getQualityRefreshSessionJob(targetPackId);
      if (job?.status === "running") {
        setQualityRefreshing(true);
        setQualityStartedAt(job.startedAt);
        setQualityActiveIndex(
          qualityRefreshProgressIndex(
            job.startedAt,
            Date.now(),
            QUALITY_PIPELINE_STEPS.length,
            QUALITY_STEP_TICK_MS,
          ),
        );
        try {
          const res = await job.promise;
          if (cancelled || packIdRef.current !== targetPackId) return;
          await applyQualityRefreshResultRef.current(targetPackId, res);
        } catch (err) {
          if (cancelled || packIdRef.current !== targetPackId) return;
          setError(err instanceof Error ? err.message : "품질 점검에 실패했습니다.");
        } finally {
          if (!cancelled && packIdRef.current === targetPackId) {
            setQualityRefreshing(false);
            setQualityStartedAt(null);
          }
        }
        return;
      }

      if (job?.status === "done") {
        if (cancelled) return;
        setQualityResult(job.result);
        await loadEvidenceForPackRef.current(targetPackId);
        return;
      }

      if (job?.status === "error") {
        if (cancelled) return;
        setError(job.message);
        return;
      }

      // No session job — show persisted final quality results when generation is done.
      if (!generationDone) return;
      setEvidenceLoading(true);
      setEvidenceError(null);
      try {
        const data = await fetchAdminReviewDetail(targetPackId);
        if (cancelled || packIdRef.current !== targetPackId) return;
        // A concurrent refresh may have started while we were loading.
        if (isQualityRefreshSessionRunning(targetPackId)) return;
        setEvidenceDetail(data.detail);
        setQualityResult(buildQualitySnapshotFromDetail(data.detail, targetPackId));
      } catch (err) {
        if (cancelled || packIdRef.current !== targetPackId) return;
        setEvidenceError(
          err instanceof Error ? err.message : "품질 점검 결과를 불러오지 못했습니다.",
        );
      } finally {
        if (!cancelled && packIdRef.current === targetPackId) setEvidenceLoading(false);
      }
    };

    void rehydrate();
    return () => {
      cancelled = true;
    };
  }, [packId, showQualityUi, generationDone]);

  return (
    <div className="space-y-3">
      {showGenerationUi ? (
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <AdminPanelIconButton
              title={generationCollapsed ? "펼치기" : "접기"}
              onClick={() => setGenerationCollapsed((v) => !v)}
              aria-expanded={!generationCollapsed}
            >
              <AdminPanelCollapseIcon collapsed={generationCollapsed} />
            </AdminPanelIconButton>
            <h2 className="text-sm font-bold text-slate-900">지식데이터 생성</h2>
            {generationCollapsed && hasRequest ? (
              <span className="truncate text-[11px] text-store-muted">
                {statusLabel(state!.requestStatus)}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void onExecute()}
            disabled={running || !hasRequest || inProgress || canAccept || isRejected}
            className="min-h-[36px] shrink-0 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-60"
          >
            {running
              ? "생성 실행 중…"
              : status === "FAILED" || failed
                ? "재생성 실행"
                : "지식데이터 생성 실행"}
          </button>
        </div>

        {generationCollapsed ? null : (
          <>
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
            아직 접수된 생성 요청(ZIP 자료)이 없습니다. 자료 접수 단계에서 먼저 접수하세요.
          </p>
        )}

        {isRejected ? (
          <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
            이 요청은 반려되었습니다. 반려 취소·재접수는{" "}
            <a
              href={`/admin/reviews/${encodeURIComponent(packId)}?step=receipt`}
              className="font-semibold underline"
            >
              자료 접수
            </a>{" "}
            단계에서 처리하세요.
          </p>
        ) : null}

        {canAccept ? (
          <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-950">
            아직 자료 접수가 되지 않았습니다.{" "}
            <a
              href={`/admin/reviews/${encodeURIComponent(packId)}?step=receipt`}
              className="font-semibold underline"
            >
              자료 접수
            </a>{" "}
            단계에서 먼저 접수하세요. 이 단계에서는 생성 실행만 진행합니다.
          </p>
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
            {workbenchMode !== "generation" ? (
              <p className="mt-1 text-[11px] text-emerald-800">
                Worker 작업 내역을 확인한 뒤, 아래 품질 점검을 실행해 주세요.
              </p>
            ) : null}
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

        <AdminWorkerZipRunsPanel
          packId={packId}
          refreshKey={runsRefreshKey}
          embedded
        />
          </>
        )}
      </section>
      ) : null}

      {showQualityUi ? (
        <section
          id="admin-quality-section"
          className="scroll-mt-24 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <AdminPanelIconButton
                title={qualityCollapsed ? "펼치기" : "접기"}
                onClick={() => setQualityCollapsed((v) => !v)}
                aria-expanded={!qualityCollapsed}
              >
                <AdminPanelCollapseIcon collapsed={qualityCollapsed} />
              </AdminPanelIconButton>
              <h2 className="text-sm font-bold text-slate-900">품질점검</h2>
              {qualityCollapsed && qualityResult ? (
                <span className="truncate text-[11px] text-store-muted">
                  {qualityReviewAcknowledged ? "확인 완료" : "점검 완료"}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void onQualityRefresh()}
                disabled={!generationDone || !canQualityRefresh}
                title={
                  qualityReviewAcknowledged
                    ? "완료를 취소한 뒤 다시 실행할 수 있습니다."
                    : undefined
                }
                className="min-h-[36px] shrink-0 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-60"
              >
                {qualityRefreshing ? "실행 중…" : "실행"}
              </button>
              <button
                type="button"
                onClick={onAcknowledgeQualityReview}
                disabled={!canAcknowledgeQualityReview}
                className="min-h-[36px] shrink-0 rounded-lg bg-store-accent px-3 text-xs font-bold text-white disabled:opacity-60"
              >
                완료
              </button>
              <button
                type="button"
                onClick={onCancelQualityReviewAck}
                disabled={!canCancelQualityReviewAck}
                className="min-h-[36px] shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 disabled:opacity-60"
              >
                완료취소
              </button>
            </div>
          </div>

          {qualityCollapsed ? null : (
            <>
              {qualityReviewAcknowledged ? (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  품질점검 결과 확인을 완료했습니다. 보정 단계로 진행할 수 있습니다. 다시
                  점검하려면 「완료취소」 후 「실행」하세요.
                </p>
              ) : null}
              {!generationDone ? (
                <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  지식데이터 생성이 완료된 뒤에 품질점검을 실행할 수 있습니다.
                </p>
              ) : null}

              {error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </div>
              ) : null}

              {qualityRefreshing ? (
                <QualityPipelineProgress
                  mode="running"
                  activeIndex={qualityActiveIndex}
                  startedAtMs={qualityStartedAt}
                  nowMs={nowTick}
                />
              ) : null}

              {qualityResult && !qualityRefreshing ? (
                <QualityCheckHistoryCard
                  packId={packId}
                  qualityResult={qualityResult}
                  detail={evidenceDetail}
                  loading={evidenceLoading}
                  error={evidenceError}
                  revealKey={qualityResultsRevealKey}
                  onRetry={() => void reloadEvidenceDetail()}
                  embedded
                />
              ) : null}

              {!qualityRefreshing && !qualityResult && evidenceLoading ? (
                <p className="text-xs text-store-muted">품질점검 결과를 불러오는 중…</p>
              ) : null}

              {!qualityRefreshing && !qualityResult && !evidenceLoading && generationDone ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-store-muted">
                  품질점검 결과가 없습니다. 「실행」으로 이번 생성분 점검을 시작하세요.
                </p>
              ) : null}
            </>
          )}
        </section>
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
  revealKey = 0,
  onRetry,
  embedded = false,
}: {
  readonly packId: string;
  readonly qualityResult: AdminWorkerZipQualityRefreshResult;
  readonly detail: AdminReviewDetailDto | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** Bump to force-expand and scroll this card into view. */
  readonly revealKey?: number;
  readonly onRetry: () => void;
  /** When true, render as an inner section (no outer card chrome). */
  readonly embedded?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const readiness = qualityResult.readiness;
  const revealKeyRef = useRef(0);

  useEffect(() => {
    if (!revealKey || revealKey === revealKeyRef.current) return;
    revealKeyRef.current = revealKey;
    setCollapsed(false);
    const frame = requestAnimationFrame(() => {
      document.getElementById("admin-quality-results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [revealKey]);

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
    <section
      id="admin-quality-results"
      className={
        embedded
          ? "scroll-mt-24 space-y-3 border-t border-slate-100 pt-3"
          : "scroll-mt-24 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <AdminPanelIconButton
              title={collapsed ? "펼치기" : "접기"}
              onClick={() => setCollapsed((v) => !v)}
              aria-expanded={!collapsed}
            >
              <AdminPanelCollapseIcon collapsed={collapsed} />
            </AdminPanelIconButton>
            <p className="text-sm font-bold text-slate-900">품질점검 결과</p>
            <AdminPanelIconButton title="새로고침" onClick={onRetry} disabled={loading}>
              <AdminPanelRefreshIcon spinning={loading} />
            </AdminPanelIconButton>
            <AdminPanelIconButton title="점검내역 MD 다운로드" onClick={onDownloadMarkdown}>
              <AdminPanelDownloadIcon />
            </AdminPanelIconButton>
          </div>
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

/**
 * After the admin reviews quality results, route BLOCKER/FAIL to correction.
 * WARNING-only may proceed to service validation (P2.1 / P4 policy).
 */
function resolveQualityReviewCompleteDestination(
  qualityResult: AdminWorkerZipQualityRefreshResult,
  detail: AdminReviewDetailDto | null,
): "correction" | "serviceValidation" {
  if (detail) {
    const gate = buildAdminQualityGateSnapshot(detail);
    if (gate.hasBlockers || gate.failCount > 0) return "correction";
    return "serviceValidation";
  }
  const r = qualityResult.readiness;
  const fail =
    r.sourceValidation.failCount > 0 ||
    r.structureCoverageStatus === "FAIL" ||
    r.knowledgeQualityStatus === "FAIL" ||
    r.chunkQualityStatus === "FAIL" ||
    r.retrievalEvaluationStatus === "FAIL" ||
    r.releaseGateStatus === "FAIL";
  if (fail) return "correction";
  return "serviceValidation";
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
    case "admin_preflight_excluded":
      return "사전정리 제외";
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
