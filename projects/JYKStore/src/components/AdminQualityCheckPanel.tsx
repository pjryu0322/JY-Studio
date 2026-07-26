"use client";

import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";

/**
 * Workbench step2 — 품질점검 상태 요약.
 * 실행 UI는 AdminWorkerZipGenerationCard `#admin-quality-section`에 두고,
 * 여기서는 결과 요약·다음 액션만 보여 중복 안내를 피한다.
 */
export function AdminQualityCheckPanel({
  quality,
  generationDone,
  onRerunQuality,
  onScrollToQuality,
}: {
  readonly quality: AdminQualityGateSnapshot;
  readonly generationDone: boolean;
  readonly onRerunQuality?: () => void;
  readonly onScrollToQuality?: () => void;
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
    statusLabel = "관리자 확인 필요 (WARNING)";
    tone = "border-amber-200 bg-amber-50 text-amber-950";
  } else {
    statusLabel = "제공자 검토요청 가능";
    tone = "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

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
      <div className="flex flex-wrap gap-2">
        {generationDone ? (
          <button
            type="button"
            onClick={() => {
              onScrollToQuality?.();
              onRerunQuality?.();
            }}
            className="min-h-[36px] rounded-xl border border-current/20 bg-white px-3 text-xs font-bold"
          >
            {quality.completed ? "품질점검 재실행" : "품질점검 실행"}
          </button>
        ) : null}
        {generationDone && quality.completed ? (
          <button
            type="button"
            onClick={() => onScrollToQuality?.()}
            className="min-h-[36px] rounded-xl border border-current/20 bg-white/70 px-3 text-xs font-semibold"
          >
            상세 결과로 이동
          </button>
        ) : null}
      </div>
    </section>
  );
}
