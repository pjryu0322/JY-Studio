"use client";

import { useState } from "react";
import type { StructureQualitySummaryDto } from "@/lib/structure-quality/structure-quality-dto";

function statusClass(status: string | undefined): string {
  if (status === "FAIL") return "text-red-800 bg-red-50 border-red-200";
  if (status === "WARNING") return "text-amber-900 bg-amber-50 border-amber-200";
  if (status === "PASS") return "text-emerald-900 bg-emerald-50 border-emerald-200";
  return "text-slate-700 bg-slate-50 border-slate-200";
}

export function StructureQualityPanel({
  packId,
  structureQuality,
  editable,
  onEvaluate,
}: {
  readonly packId: string;
  readonly structureQuality: StructureQualitySummaryDto | null;
  readonly editable: boolean;
  readonly onEvaluate: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onEvaluate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "구조/품질 점검에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const coverage = structureQuality?.structureCoverage;
  const quality = structureQuality?.knowledgeQuality;
  const freshness = structureQuality?.freshness;
  const freshnessLabel =
    freshness?.status === "CURRENT"
      ? "최신"
      : freshness?.status === "STALE"
        ? "재평가 필요"
        : freshness?.status === "MISSING"
          ? "미실행"
          : null;
  const freshnessClass =
    freshness?.status === "CURRENT"
      ? "text-emerald-800 bg-emerald-50 border-emerald-200"
      : freshness?.status === "STALE"
        ? "text-amber-900 bg-amber-50 border-amber-200"
        : "text-slate-700 bg-slate-50 border-slate-200";
  const missingRequired =
    coverage?.items.filter((item) => item.required && !item.covered) ?? [];

  return (
    <section
      id={`structure-quality-${packId}`}
      className="rounded-2xl border border-store-border bg-white p-4 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">구조/품질 점검</h2>
        {editable ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run()}
            className="min-h-[44px] w-full rounded-xl border border-store-border px-4 text-sm font-semibold disabled:opacity-50 sm:w-auto"
          >
            {busy ? "점검 중…" : "구조/품질 재평가"}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-store-muted">
        템플릿: {structureQuality?.structureTemplateName ?? "—"} (
        {structureQuality?.structureTemplateKey ?? "미지정"})
      </p>
      {freshnessLabel ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${freshnessClass}`}
          >
            최신성: {freshnessLabel}
          </span>
          {freshness?.latestVersionId ? (
            <span className="text-[10px] text-store-muted">
              버전 ID: {freshness.latestVersionId.slice(0, 8)}…
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
      {(coverage?.checkedAt || quality?.checkedAt) && freshness?.status === "CURRENT" ? (
        <p className="mt-1 text-[10px] text-store-muted">
          점검 시각 — 구조: {coverage?.checkedAt ?? "—"} · 품질: {quality?.checkedAt ?? "—"}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}

      {!coverage && !quality ? (
        <p className="mt-3 text-sm text-store-muted">
          아직 구조/품질 점검 결과가 없습니다. 검수 제출 전 점검을 실행해 주세요.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className={`rounded-xl border p-3 ${statusClass(coverage?.status)}`}>
            <p className="text-xs font-semibold">구조 커버리지</p>
            <p className="mt-1 text-2xl font-bold">{coverage?.coverageScore ?? "—"}</p>
            <p className="mt-1 text-xs">
              필수 {coverage?.coveredRequiredCount ?? 0}/{coverage?.requiredSectionCount ?? 0} ·
              누락 {coverage?.missingRequiredCount ?? 0}
            </p>
            <p className="mt-2 text-xs whitespace-pre-wrap">{coverage?.summary}</p>
          </div>
          <div className={`rounded-xl border p-3 ${statusClass(quality?.status)}`}>
            <p className="text-xs font-semibold">지식 품질</p>
            <p className="mt-1 text-2xl font-bold">{quality?.totalScore ?? "—"}</p>
            <p className="mt-1 text-xs">
              완전성 {quality?.completenessScore ?? "—"} · 일관성 {quality?.consistencyScore ?? "—"} ·
              원천 {quality?.sourceQualityScore ?? "—"}
            </p>
            <p className="mt-1 text-xs">
              보안 {quality?.securityScore ?? "—"} · 신선도 {quality?.freshnessScore ?? "—"} · 활용{" "}
              {quality?.usabilityScore ?? "—"}
            </p>
            <p className="mt-2 text-xs whitespace-pre-wrap">{quality?.summary}</p>
          </div>
        </div>
      )}

      {missingRequired.length > 0 ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-900">누락된 필수 섹션</p>
          <ul className="mt-2 space-y-1">
            {missingRequired.map((item) => (
              <li key={item.sectionKey} className="text-xs text-red-800">
                {item.title} ({item.sectionKey})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {quality && quality.issues.length > 0 ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-bold text-slate-900">품질 이슈</p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
            {quality.issues.slice(0, 10).map((issue, index) => (
              <li
                key={`${issue.code}-${index}`}
                className={`whitespace-pre-wrap text-xs ${issue.severity === "BLOCKER" ? "text-red-800" : "text-amber-800"}`}
              >
                <span className="font-mono text-[10px]">{issue.severity}</span> {issue.code}:{" "}
                {issue.message}
                {issue.hint ? <span className="text-store-muted"> — {issue.hint}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
