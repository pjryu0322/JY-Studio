"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminWorkerZipRuns,
  type AdminWorkerZipRunView,
} from "@/lib/admin-review-api";
import { describeWorkerZipStepLabel, formatDurationMs } from "@/lib/worker-zip-step-labels";

/**
 * P7.5: Admin "Worker 작업 내역" — recent ZIP generation runs for a pack. Shows the
 * running/completed/failed history with the current step, timing, result summary,
 * and (for failures) the failing step + error. `refreshKey` lets the parent force
 * a reload after an execution finishes.
 */
export function AdminWorkerZipRunsPanel({
  packId,
  refreshKey = 0,
}: {
  readonly packId: string;
  readonly refreshKey?: number;
}) {
  const [runs, setRuns] = useState<AdminWorkerZipRunView[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminWorkerZipRuns(packId);
      setRuns(res.runs);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Worker 작업 내역</h3>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-slate-500 underline disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {runs.length === 0 ? (
        <p className="text-xs text-slate-500">아직 실행된 작업이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {runs.map((run) => {
            const failed = run.status === "FAIL";
            const running = run.status === "RUNNING";
            return (
              <li
                key={run.runId}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  failed
                    ? "border-red-200 bg-red-50"
                    : running
                      ? "border-indigo-200 bg-indigo-50"
                      : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-semibold ${
                      failed ? "text-red-800" : running ? "text-indigo-800" : "text-slate-900"
                    }`}
                  >
                    {runStatusLabel(run.status)}
                  </span>
                  <span className="text-slate-500">{formatDateTime(run.startedAt)}</span>
                </div>

                <dl className="mt-1 space-y-0.5 text-slate-600">
                  <Row label="현재 단계" value={run.currentStepLabel || describeWorkerZipStepLabel(run.currentStep)} />
                  <Row
                    label="경과 시간"
                    value={
                      run.durationMs != null
                        ? formatDurationMs(run.durationMs)
                        : running
                          ? "진행 중"
                          : "-"
                    }
                  />
                  {run.summary ? (
                    <>
                      {typeof run.summary.excludedFiles === "number" ? (
                        <Row label="제외 파일" value={`${run.summary.excludedFiles}개`} />
                      ) : null}
                      {typeof run.summary.importedChunkCount === "number" ? (
                        <Row label="검색 청크" value={`${run.summary.importedChunkCount}개`} />
                      ) : null}
                      {typeof run.summary.importedEmbeddingCount === "number" ? (
                        <Row label="검색데이터" value={`${run.summary.importedEmbeddingCount}개`} />
                      ) : null}
                    </>
                  ) : null}
                </dl>

                {failed ? (
                  <div className="mt-1 rounded-lg bg-white/70 px-2 py-1 text-red-900">
                    <p className="font-semibold">
                      실패 단계: {run.currentStepLabel || describeWorkerZipStepLabel(run.currentStep) || "-"}
                    </p>
                    {run.errorMessage ? <p className="mt-0.5">오류: {run.errorMessage}</p> : null}
                  </div>
                ) : null}

                {run.stepLogs.length > 0 ? (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => setExpanded((v) => (v === run.runId ? null : run.runId))}
                      className="text-[11px] text-slate-500 underline"
                    >
                      {expanded === run.runId ? "단계 로그 접기" : "단계 로그 펼치기"}
                    </button>
                    {expanded === run.runId ? (
                      <ol className="mt-1 space-y-0.5">
                        {run.stepLogs.map((log, idx) => (
                          <li key={`${run.runId}-${idx}`} className="flex justify-between gap-2 text-slate-600">
                            <span>
                              {stepStatusMark(log.status)} {describeWorkerZipStepLabel(log.step)}
                              {log.message ? ` — ${log.message}` : ""}
                            </span>
                            <span className="text-slate-400">{formatTime(log.createdAt)}</span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function runStatusLabel(status: AdminWorkerZipRunView["status"]): string {
  switch (status) {
    case "RUNNING":
      return "생성 실행 중";
    case "PASS":
      return "생성 완료";
    case "FAIL":
      return "생성 실패";
    case "SKIPPED":
      return "중단됨";
    default:
      return status;
  }
}

function stepStatusMark(status: AdminWorkerZipRunView["stepLogs"][number]["status"]): string {
  switch (status) {
    case "PASS":
      return "✓";
    case "FAIL":
      return "✕";
    case "RUNNING":
      return "…";
    default:
      return "·";
  }
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("ko-KR", { timeStyle: "medium" });
}
