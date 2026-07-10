"use client";

import { useState } from "react";
import type { ReleaseGateSummaryDto } from "@/lib/release-gate/release-gate-dto";

function statusClass(status: string | undefined): string {
  if (status === "FAIL") return "text-red-800 bg-red-50 border-red-200";
  if (status === "WARNING") return "text-amber-900 bg-amber-50 border-amber-200";
  if (status === "PASS") return "text-emerald-900 bg-emerald-50 border-emerald-200";
  return "text-slate-700 bg-slate-50 border-slate-200";
}

function freshnessClass(status: string | undefined): string {
  if (status === "CURRENT") return "text-emerald-800 bg-emerald-50 border-emerald-200";
  if (status === "STALE") return "text-amber-900 bg-amber-50 border-amber-200";
  return "text-slate-700 bg-slate-50 border-slate-200";
}

function freshnessLabel(status: string | undefined): string | null {
  if (status === "CURRENT") return "최신";
  if (status === "STALE") return "재점검 필요";
  if (status === "MISSING") return "미실행";
  return null;
}

function severityBadge(severity: string): string {
  if (severity === "BLOCKER") return "차단";
  return "경고";
}

export function ReleaseGatePanel({
  packId,
  releaseGate,
  editable,
  evaluateButtonLabel,
  onEvaluate,
}: {
  readonly packId: string;
  readonly releaseGate: ReleaseGateSummaryDto | null;
  readonly editable: boolean;
  readonly evaluateButtonLabel?: string;
  readonly onEvaluate: (targetStatus?: "PUBLISHED" | "VERIFIED") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestRun = releaseGate?.latestRun;
  const freshness = releaseGate?.freshness;

  const runEvaluate = async () => {
    setBusy(true);
    setError(null);
    try {
      await onEvaluate("PUBLISHED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "릴리스 게이트 재점검에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id={`release-gate-${packId}`}
      className="rounded-2xl border border-store-border bg-white p-4 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">릴리스 게이트</h2>
        {editable ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void runEvaluate()}
            className="min-h-[44px] w-full rounded-xl border border-store-border bg-white px-4 text-sm font-semibold text-slate-900 disabled:opacity-50 sm:w-auto"
          >
            {busy ? "점검 중…" : evaluateButtonLabel ?? "릴리스 게이트 재점검"}
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-store-muted">
        공개 승인 전 Source·구조·청킹·검색 품질을 통합 점검합니다. 승인 직전에도 최신 상태로 다시
        평가됩니다.
      </p>

      {error ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {latestRun ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(latestRun.status)}`}
          >
            {latestRun.status}
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
            미실행
          </span>
        )}
        {freshnessLabel(freshness?.status) ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${freshnessClass(freshness?.status)}`}
          >
            {freshnessLabel(freshness?.status)}
          </span>
        ) : null}
        {latestRun ? (
          <span className="text-xs text-store-muted">
            대상 {latestRun.targetStatus} · {new Date(latestRun.checkedAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      {freshness?.reason ? (
        <p className="mt-2 text-xs text-amber-900">{freshness.reason}</p>
      ) : null}

      {latestRun ? (
        <>
          <p className="mt-2 text-xs text-slate-800 whitespace-pre-wrap">{latestRun.summary}</p>
          <ul className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-800 sm:grid-cols-2">
            <li>원천: {latestRun.sourceStatus ?? "—"}</li>
            <li>구조: {latestRun.structureStatus ?? "—"}</li>
            <li>청킹: {latestRun.chunkStatus ?? "—"}</li>
            <li>검색: {latestRun.retrievalStatus ?? "—"}</li>
            <li>그래프: {latestRun.graphStatus ?? "—"}</li>
            <li>
              이슈: 차단 {latestRun.blockingIssueCount} · 경고 {latestRun.warningIssueCount}
            </li>
          </ul>

          {latestRun.issues.length > 0 ? (
            <ul className="mt-3 max-h-48 space-y-2 overflow-auto text-xs">
              {latestRun.issues.map((issue, index) => (
                <li
                  key={`${issue.code}-${index}`}
                  className={`rounded-lg border p-2 ${
                    issue.severity === "BLOCKER"
                      ? "border-red-200 bg-red-50 text-red-900"
                      : "border-amber-200 bg-amber-50 text-amber-950"
                  }`}
                >
                  <span className="mr-2 font-bold">[{severityBadge(issue.severity)}]</span>
                  <span className="font-semibold">{issue.code}</span>
                  <p className="mt-1">{issue.message}</p>
                  {issue.hint ? <p className="mt-1 text-store-muted">{issue.hint}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-xs text-store-muted">
          릴리스 게이트 재점검을 실행하면 승인 가능 여부를 확인할 수 있습니다.
        </p>
      )}
    </section>
  );
}
