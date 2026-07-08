"use client";

import { useState } from "react";
import type { RetrievalEvaluationSummaryDto } from "@/lib/retrieval-evaluation/retrieval-evaluation-dto";

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
  if (status === "STALE") return "재평가 필요";
  if (status === "MISSING") return "미실행";
  return null;
}

export function RetrievalEvaluationPanel({
  packId,
  retrievalEvaluation,
  editable,
  onGenerate,
  onRun,
}: {
  readonly packId: string;
  readonly retrievalEvaluation: RetrievalEvaluationSummaryDto | null;
  readonly editable: boolean;
  readonly onGenerate: (replace?: boolean) => Promise<void>;
  readonly onRun: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"generate" | "run" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setSummary = retrievalEvaluation?.set;
  const latestRun = retrievalEvaluation?.latestRun;
  const freshness = retrievalEvaluation?.freshness;

  const runAction = async (action: "generate" | "run", fn: () => Promise<void>) => {
    setBusy(action);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : action === "generate"
            ? "검색 품질 평가 케이스 생성에 실패했습니다."
            : "검색 품질 평가 실행에 실패했습니다.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      id={`retrieval-evaluation-${packId}`}
      className="rounded-2xl border border-store-border bg-white p-4 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">검색 품질 평가</h2>
        {editable ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runAction("generate", () => onGenerate(true))}
              className="min-h-[44px] w-full rounded-xl border border-store-border px-4 text-sm font-semibold disabled:opacity-50 sm:w-auto"
            >
              {busy === "generate" ? "생성 중…" : "케이스 자동 생성"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runAction("run", () => onRun())}
              className="min-h-[44px] w-full rounded-xl border border-store-border px-4 text-sm font-semibold disabled:opacity-50 sm:w-auto"
            >
              {busy === "run" ? "평가 중…" : "평가 실행"}
            </button>
          </div>
        ) : null}
      </div>

      {setSummary ? (
        <p className="mt-2 text-xs text-store-muted">
          세트: <span className="font-semibold text-slate-900">{setSummary.name}</span>
          {" · "}활성 케이스 {setSummary.activeCaseCount}개
        </p>
      ) : (
        <p className="mt-2 text-xs text-store-muted">활성 평가 세트가 없습니다.</p>
      )}

      {freshnessLabel(freshness?.status) ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${freshnessClass(freshness?.status)}`}
          >
            최신성: {freshnessLabel(freshness?.status)}
          </span>
          {latestRun ? (
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(latestRun.status)}`}
            >
              상태: {latestRun.status}
            </span>
          ) : null}
        </div>
      ) : null}

      {freshness?.status === "STALE" && freshness.reason ? (
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
          {freshness.reason}
        </p>
      ) : null}
      {freshness?.status === "MISSING" && freshness.reason ? (
        <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {freshness.reason}
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}

      {!latestRun ? (
        <p className="mt-3 text-sm text-store-muted">
          아직 검색 품질 평가 결과가 없습니다. 케이스를 생성한 뒤 평가를 실행해 주세요.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-store-muted whitespace-pre-wrap">{latestRun.summary}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              ["총점", latestRun.totalScore],
              ["평균 점수", latestRun.averageScore],
              ["Hit Rate", latestRun.hitRate],
              ["MRR", latestRun.meanReciprocalRank],
            ].map(([label, score]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              >
                <span className="text-store-muted">{label}</span>
                <span className="ml-2 font-bold text-slate-900">{score}</span>
              </div>
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-800 sm:grid-cols-2">
            <li>통과: {latestRun.passCaseCount}</li>
            <li>주의: {latestRun.warningCaseCount}</li>
            <li>실패: {latestRun.failCaseCount}</li>
            <li>
              평가: {latestRun.evaluatedCaseCount}/{latestRun.totalCaseCount}
            </li>
          </ul>
          {latestRun.issues.length > 0 ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-900">주요 이슈</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                {latestRun.issues.slice(0, 10).map((issue, index) => (
                  <li
                    key={`${issue.code}-${index}`}
                    className={`whitespace-pre-wrap text-xs ${issue.severity === "BLOCKER" ? "text-red-800" : "text-amber-800"}`}
                  >
                    <span className="font-mono text-[10px]">{issue.severity}</span> {issue.code}:{" "}
                    {issue.message}
                    {issue.hint ? (
                      <span className="text-store-muted"> — {issue.hint}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {latestRun.failedResults && latestRun.failedResults.length > 0 ? (
            <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3">
              <p className="text-xs font-bold text-red-900">실패 샘플</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                {latestRun.failedResults.slice(0, 5).map((item) => (
                  <li key={`${item.caseId}-${item.retrievalMode}`} className="text-xs text-red-800">
                    [{item.retrievalMode}] {item.query}
                    {item.issueCodes.length > 0 ? (
                      <span className="text-store-muted"> ({item.issueCodes.join(", ")})</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
