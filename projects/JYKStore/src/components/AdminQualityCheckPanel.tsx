"use client";

import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";

/**
 * Workbench — 품질점검 상태 요약.
 * 실행/완료/완료취소 CTA는 AdminWorkerZipGenerationCard 헤더에 둔다.
 */
export function AdminQualityCheckPanel({
  quality,
  generationDone,
  onScrollToQuality,
  onGoCorrection,
  onGoProviderReview,
}: {
  readonly quality: AdminQualityGateSnapshot;
  readonly generationDone: boolean;
  readonly onRerunQuality?: () => void;
  readonly onScrollToQuality?: () => void;
  readonly onGoCorrection?: () => void;
  readonly onGoProviderReview?: () => void;
}) {
  let statusLabel = "품질점검 대기";
  let tone = "border-slate-200 bg-slate-50 text-slate-800";
  if (!generationDone) {
    statusLabel = "생성 완료 후 실행";
  } else if (!quality.completed) {
    statusLabel = "품질점검 미실행";
    tone = "border-indigo-200 bg-indigo-50 text-indigo-950";
  } else if (quality.hasBlockers || quality.failCount > 0) {
    statusLabel = "보정 필요 (차단)";
    tone = "border-red-200 bg-red-50 text-red-900";
  } else if (quality.hasWarnings) {
    statusLabel = "경고 있음 — 서비스 검증 가능";
    tone = "border-amber-200 bg-amber-50 text-amber-950";
  } else {
    statusLabel = "서비스 검증으로 진행 가능";
    tone = "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  const canNavigate =
    generationDone && quality.completed;
  const needsCorrection =
    canNavigate && (quality.hasBlockers || quality.failCount > 0);
  const canGoServiceValidation = canNavigate && !needsCorrection;

  return (
    <section className={`space-y-2 rounded-2xl border px-4 py-3 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">품질점검 요약</h2>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold">
          {statusLabel}
        </span>
      </div>
      <p className="text-xs">
        차단 {quality.blockers.length}건 · 주의 {quality.warnings.length}건
        {quality.completed ? "" : " · 아직 결과가 없습니다"}
      </p>
      {quality.blockers.length > 0 ? (
        <ul className="list-disc pl-4 text-xs">
          {quality.blockers.slice(0, 3).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-[11px] opacity-80">
        상단 「실행」으로 점검을 돌리고, 결과 확인 후 「완료」하면 다음 단계로 진행합니다. 다시
        점검하려면 「완료취소」 후 「실행」하세요.
      </p>
      <div className="flex flex-wrap gap-2">
        {canNavigate ? (
          <button
            type="button"
            onClick={() => onScrollToQuality?.()}
            className="min-h-[36px] rounded-xl border border-current/20 bg-white/70 px-3 text-xs font-semibold"
          >
            상세 결과로 이동
          </button>
        ) : null}
        {canNavigate && needsCorrection ? (
          <button
            type="button"
            onClick={() => onGoCorrection?.()}
            className="min-h-[36px] rounded-xl border border-current/20 bg-white px-3 text-xs font-bold"
          >
            보정으로 이동
          </button>
        ) : null}
        {canGoServiceValidation ? (
          <button
            type="button"
            onClick={() => onGoProviderReview?.()}
            className="min-h-[36px] rounded-xl border border-current/20 bg-white px-3 text-xs font-bold"
          >
            서비스 검증으로 이동
          </button>
        ) : null}
        {canNavigate && quality.hasWarnings && !needsCorrection ? (
          <button
            type="button"
            onClick={() => onGoCorrection?.()}
            className="min-h-[36px] rounded-xl border border-current/20 bg-white/70 px-3 text-xs font-semibold"
          >
            경고 상세(보정)
          </button>
        ) : null}
      </div>
    </section>
  );
}
