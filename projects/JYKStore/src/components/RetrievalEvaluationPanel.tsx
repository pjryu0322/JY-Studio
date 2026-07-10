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

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function mrr(value: number): string {
  return value.toFixed(2);
}

function userFacingStatus(status: string | undefined): string {
  if (status === "PASS") return "통과";
  if (status === "WARNING") return "보완 필요";
  if (status === "FAIL") return "실패";
  return "미실행";
}

export function RetrievalEvaluationPanel({
  packId,
  retrievalEvaluation,
  editable,
  generateButtonLabel,
  runButtonLabel,
  repairButtonLabel,
  onGenerate,
  onRun,
  onRepair,
}: {
  readonly packId: string;
  readonly retrievalEvaluation: RetrievalEvaluationSummaryDto | null;
  readonly editable: boolean;
  readonly generateButtonLabel?: string;
  readonly runButtonLabel?: string;
  readonly repairButtonLabel?: string;
  readonly onGenerate: (replace?: boolean) => Promise<void>;
  readonly onRun: () => Promise<void>;
  readonly onRepair?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"generate" | "run" | "repair" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setSummary = retrievalEvaluation?.set;
  const latestRun = retrievalEvaluation?.latestRun;
  const freshness = retrievalEvaluation?.freshness;

  const runAction = async (
    action: "generate" | "run" | "repair",
    fn: () => Promise<void>,
  ) => {
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
            : action === "repair"
              ? "검색용 데이터 자동 보완에 실패했습니다."
              : "검색 품질 평가 실행에 실패했습니다.",
      );
    } finally {
      setBusy(null);
    }
  };

  const causes: string[] = [];
  if (latestRun?.status === "FAIL" || latestRun?.status === "WARNING") {
    if (latestRun.failCaseCount > 0) {
      causes.push(`평가 케이스 ${latestRun.failCaseCount}개가 현재 지식 범위와 맞지 않습니다.`);
    }
    if (latestRun.caseHitRate < 0.7) {
      causes.push("검색 결과 적중률이 기준보다 낮습니다.");
    }
    const sampleQueries = (latestRun.failedResults ?? [])
      .map((item) => item.query)
      .filter(Boolean)
      .slice(0, 3);
    if (sampleQueries.length > 0) {
      causes.push(`관련 지식 부족 가능: ${sampleQueries.join(", ")}`);
    }
  }

  return (
    <section
      id={`retrieval-evaluation-${packId}`}
      className="rounded-2xl border border-store-border bg-white p-4 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">검색 품질 평가</h2>
        {editable && onRepair ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void runAction("repair", () => onRepair())}
            className="min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
          >
            {busy === "repair"
              ? "자동 보완 중…"
              : repairButtonLabel ?? "검색용 데이터 자동 보완"}
          </button>
        ) : null}
      </div>

      {setSummary ? (
        <p className="mt-2 text-xs text-store-muted">활성 케이스 {setSummary.activeCaseCount}개</p>
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
              검색 품질: {userFacingStatus(latestRun.status)}
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}

      {!latestRun ? (
        <p className="mt-3 text-sm text-store-muted">
          아직 검색 품질 평가 결과가 없습니다. 자동 점검을 실행하면 케이스가 준비됩니다.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            검색 품질: {userFacingStatus(latestRun.status)}
          </p>
          {causes.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
              {causes.slice(0, 3).map((cause) => (
                <li key={cause}>{cause}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-store-muted">검색 품질 점검이 기준을 충족했습니다.</p>
          )}

          <details className="mt-3 rounded-xl border border-store-border bg-slate-50">
            <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-900">
              상세 검색 품질 지표
            </summary>
            <div className="space-y-3 border-t border-store-border p-3">
              <p className="text-xs text-store-muted whitespace-pre-wrap">{latestRun.summary}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  ["총점", String(latestRun.totalScore)],
                  ["Case Hit Rate", pct(latestRun.caseHitRate)],
                  ["Case MRR", mrr(latestRun.caseMeanReciprocalRank)],
                  ["Result Hit Rate", pct(latestRun.resultHitRate)],
                ].map(([label, score]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    <span className="text-store-muted">{label}</span>
                    <span className="ml-2 font-bold text-slate-900">{score}</span>
                  </div>
                ))}
              </div>
              <ul className="grid grid-cols-1 gap-1 text-xs text-slate-800 sm:grid-cols-2">
                <li>
                  케이스: {latestRun.evaluatedCaseCount}/{latestRun.totalCaseCount}
                </li>
                <li>
                  결과: {latestRun.evaluatedResultCount}개
                  {latestRun.modeSummary
                    ? `(keyword ${latestRun.modeSummary.keyword.evaluatedResultCount}, hybrid ${latestRun.modeSummary.hybrid.evaluatedResultCount})`
                    : null}
                </li>
                <li>
                  케이스 통과/주의/실패: {latestRun.passCaseCount}/{latestRun.warningCaseCount}/
                  {latestRun.failCaseCount}
                </li>
              </ul>
              {latestRun.modeSummary ? (
                <div className="grid grid-cols-1 gap-2">
                  <p className="text-xs font-bold text-slate-900">Mode별 결과</p>
                  {(
                    [
                      ["keyword", latestRun.modeSummary.keyword],
                      ["hybrid", latestRun.modeSummary.hybrid],
                    ] as const
                  ).map(([mode, metric]) => (
                    <div
                      key={mode}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                    >
                      <span className="font-semibold">{mode}</span>: P {metric.pass} / W{" "}
                      {metric.warning} / F {metric.fail} · Hit {pct(metric.hitRate)} · MRR{" "}
                      {mrr(metric.meanReciprocalRank)}
                    </div>
                  ))}
                </div>
              ) : null}
              {latestRun.issues.length > 0 ? (
                <div>
                  <p className="text-xs font-bold text-slate-900">주요 이슈</p>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                    {latestRun.issues.slice(0, 10).map((issue, index) => (
                      <li
                        key={`${issue.code}-${index}`}
                        className={`whitespace-pre-wrap text-xs ${issue.severity === "BLOCKER" ? "text-red-800" : "text-amber-800"}`}
                      >
                        <span className="font-mono text-[10px]">{issue.severity}</span> {issue.code}:{" "}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {latestRun.failedResults && latestRun.failedResults.length > 0 ? (
                <div>
                  <p className="text-xs font-bold text-red-900">실패 샘플</p>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                    {latestRun.failedResults.slice(0, 10).map((item) => (
                      <li
                        key={`${item.caseId}-${item.retrievalMode}`}
                        className="break-words text-xs text-red-800"
                      >
                        [{item.retrievalMode}] {item.query}
                        {item.issueCodes.length > 0 ? (
                          <span className="text-store-muted"> — {item.issueCodes.join(", ")}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </details>
        </>
      )}

      {editable ? (
        <details className="mt-3 rounded-xl border border-dashed border-store-border">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-store-muted">
            고급: 개별 케이스 생성/평가
          </summary>
          <div className="flex flex-col gap-2 border-t border-store-border p-3 sm:flex-row">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runAction("generate", () => onGenerate(true))}
              className="min-h-[44px] w-full rounded-xl border border-store-border px-4 text-sm font-semibold disabled:opacity-50 sm:w-auto"
            >
              {busy === "generate" ? "생성 중…" : generateButtonLabel ?? "검색 평가 케이스 생성"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runAction("run", () => onRun())}
              className="min-h-[44px] w-full rounded-xl border border-store-border px-4 text-sm font-semibold disabled:opacity-50 sm:w-auto"
            >
              {busy === "run" ? "평가 중…" : runButtonLabel ?? "검색 품질 평가 실행"}
            </button>
          </div>
        </details>
      ) : null}
    </section>
  );
}
