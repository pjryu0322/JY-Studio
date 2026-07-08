"use client";

import { useState } from "react";
import type { ChunkQualitySummaryDto } from "@/lib/chunk-quality/chunk-quality-dto";

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

function issueCategoryLabel(code: string): string | null {
  if (code.startsWith("CHUNK_DUPLICATE_")) return "중복";
  if (code.startsWith("CHUNK_STRUCTURE_")) return "구조 정렬";
  return null;
}

export function ChunkQualityPanel({
  packId,
  chunkQuality,
  editable,
  onEvaluate,
}: {
  readonly packId: string;
  readonly chunkQuality: ChunkQualitySummaryDto | null;
  readonly editable: boolean;
  readonly onEvaluate: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const report = chunkQuality?.report;
  const freshness = chunkQuality?.freshness;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onEvaluate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "청킹 품질 점검에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id={`chunk-quality-${packId}`}
      className="rounded-2xl border border-store-border bg-white p-4 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">청킹 품질 점검</h2>
        {editable ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run()}
            className="min-h-[44px] w-full rounded-xl border border-store-border px-4 text-sm font-semibold disabled:opacity-50 sm:w-auto"
          >
            {busy ? "점검 중…" : "청킹 품질 재평가"}
          </button>
        ) : null}
      </div>

      {freshnessLabel(freshness?.status) ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${freshnessClass(freshness?.status)}`}
          >
            최신성: {freshnessLabel(freshness?.status)}
          </span>
          {report ? (
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(report.status)}`}
            >
              상태: {report.status}
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

      {!report ? (
        <p className="mt-3 text-sm text-store-muted">
          아직 청킹 품질 점검 결과가 없습니다. 구조/품질 점검 후 chunk를 생성하고 점검을 실행해 주세요.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-store-muted whitespace-pre-wrap">{report.summary}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">총점 {report.totalScore}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              ["커버리지", report.coverageScore],
              ["추적성", report.traceabilityScore],
              ["크기", report.sizeScore],
              ["중복", report.duplicateScore],
              ["메타데이터", report.metadataScore],
              ["구조 정렬", report.structureAlignmentScore],
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
            <li>active chunk: {report.activeChunkCount}</li>
            <li>원천 커버: {report.coveredSourceDocumentCount}/{report.sourceDocumentCount}</li>
            <li>orphan: {report.orphanChunkCount}</li>
            <li>short/long: {report.shortChunkCount}/{report.longChunkCount}</li>
            <li>duplicate: {report.duplicateChunkCount}</li>
            <li>metadata 누락: {report.chunkWithoutMetadataCount}</li>
          </ul>
          {report.issues.length > 0 ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-900">주요 이슈</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                {report.issues.slice(0, 10).map((issue, index) => {
                  const category = issueCategoryLabel(issue.code);
                  return (
                  <li
                    key={`${issue.code}-${index}`}
                    className={`whitespace-pre-wrap text-xs ${issue.severity === "BLOCKER" ? "text-red-800" : "text-amber-800"}`}
                  >
                    <span className="font-mono text-[10px]">{issue.severity}</span>
                    {category ? (
                      <span className="ml-1 rounded bg-slate-200 px-1 py-0.5 text-[10px] font-semibold text-slate-800">
                        {category}
                      </span>
                    ) : null}{" "}
                    {issue.code}: {issue.message}
                    {issue.hint ? (
                      <span className="text-store-muted"> — {issue.hint}</span>
                    ) : null}
                  </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
