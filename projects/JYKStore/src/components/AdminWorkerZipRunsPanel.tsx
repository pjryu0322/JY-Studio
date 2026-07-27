"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminWorkerZipRuns,
  type AdminWorkerZipRunView,
} from "@/lib/admin-review-api";
import {
  AdminPanelCollapseIcon,
  AdminPanelDownloadIcon,
  AdminPanelIconButton,
  AdminPanelRefreshIcon,
} from "@/components/AdminPanelToolbarIcons";
import { buildWorkerZipRunsMarkdown } from "@/lib/worker-zip-runs-markdown";
import { describeWorkerZipStepLabel, formatDurationMs } from "@/lib/worker-zip-step-labels";

/**
 * P7.5: Admin "Worker 작업 내역" — recent ZIP generation runs for a pack. Shows the
 * latest (or in-flight) run with the current step, timing, result summary, and
 * (for failures) the failing step + error. Markdown download still includes past
 * runs. `refreshKey` lets the parent force a reload after an execution finishes.
 */
export function AdminWorkerZipRunsPanel({
  packId,
  refreshKey = 0,
  embedded = false,
}: {
  readonly packId: string;
  readonly refreshKey?: number;
  /** When true, render as an inner section (no outer card chrome). */
  readonly embedded?: boolean;
}) {
  const [runs, setRuns] = useState<AdminWorkerZipRunView[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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

  // Prefer an in-flight run as "current"; otherwise the newest (API returns newest first).
  const { currentRun, pastRuns } = useMemo(() => {
    const runningIdx = runs.findIndex((r) => r.status === "RUNNING");
    const currentIdx = runningIdx >= 0 ? runningIdx : 0;
    const current = runs[currentIdx] ?? null;
    const past = runs.filter((_, i) => i !== currentIdx);
    return { currentRun: current, pastRuns: past };
  }, [runs]);

  const runCount = runs.length;

  const onDownloadMarkdown = useCallback(() => {
    if (runs.length === 0) return;
    const markdown = buildWorkerZipRunsMarkdown({
      packId,
      currentRun,
      pastRuns,
    });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadTextFile(`worker-runs-${packId}-${stamp}.md`, markdown);
  }, [packId, runs.length, currentRun, pastRuns]);

  return (
    <section
      className={
        embedded
          ? "space-y-2 border-t border-slate-100 pt-3"
          : "space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <AdminPanelIconButton
            title={collapsed ? "펼치기" : "접기"}
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
          >
            <AdminPanelCollapseIcon collapsed={collapsed} />
          </AdminPanelIconButton>
          <p className="text-sm font-bold text-slate-900">
            Worker 작업 내역
            {collapsed && runCount > 0 ? (
              <span className="ml-1 text-xs font-normal text-slate-400">({runCount})</span>
            ) : null}
          </p>
          <AdminPanelIconButton
            title="새로고침"
            onClick={() => void load()}
            disabled={loading}
          >
            <AdminPanelRefreshIcon spinning={loading} />
          </AdminPanelIconButton>
          <AdminPanelIconButton
            title="작업 내역 MD 다운로드"
            onClick={onDownloadMarkdown}
            disabled={runs.length === 0}
          >
            <AdminPanelDownloadIcon />
          </AdminPanelIconButton>
        </div>
      </div>

      {collapsed ? null : loading && runs.length === 0 ? (
        <p className="text-xs text-slate-500">불러오는 중…</p>
      ) : runs.length === 0 ? (
        <p className="text-xs text-slate-500">아직 실행된 작업이 없습니다.</p>
      ) : currentRun ? (
        <RunCard run={currentRun} />
      ) : null}
    </section>
  );
}

function RunCard({ run }: { readonly run: AdminWorkerZipRunView }) {
  const failed = run.status === "FAIL";
  const running = run.status === "RUNNING";
  return (
    <div
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
        <Row
          label="현재 단계"
          value={run.currentStepLabel || describeWorkerZipStepLabel(run.currentStep)}
        />
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
            실패 단계:{" "}
            {run.currentStepLabel || describeWorkerZipStepLabel(run.currentStep) || "-"}
          </p>
          {run.errorMessage ? <p className="mt-0.5">오류: {run.errorMessage}</p> : null}
        </div>
      ) : null}

      {run.stepLogs.length > 0 ? (
        <ol className="mt-2 space-y-0.5 border-t border-slate-200/80 pt-2">
          {run.stepLogs.map((log, idx) => (
            <li
              key={`${run.runId}-${idx}`}
              className="flex justify-between gap-2 text-slate-600"
            >
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
