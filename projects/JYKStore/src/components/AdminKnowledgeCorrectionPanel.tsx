"use client";

import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
import { adminReviewDetailPath } from "@/lib/routes";

/**
 * Workbench step2 — 지식데이터 보정 진입점.
 * Chunk 개별 수정/삭제/부분재생성 admin route는 현재 410(legacy disabled).
 * 가능한 액션(전체 재생성·품질 재실행·제공자 검토 이동)만 노출한다.
 */
export function AdminKnowledgeCorrectionPanel({
  packId,
  workerZipPhase,
  quality,
  onGoGeneration,
  onRerunQuality,
  onGoProviderReview,
}: {
  readonly packId: string;
  readonly workerZipPhase: string;
  readonly quality: AdminQualityGateSnapshot;
  readonly onGoGeneration?: () => void;
  readonly onRerunQuality?: () => void;
  readonly onGoProviderReview?: () => void;
}) {
  const generationDone = workerZipPhase === "COMPLETED";
  const generationFailed = workerZipPhase === "FAILED";
  const needsCorrection = quality.completed && quality.hasBlockers;
  const hasWarnings = quality.completed && quality.hasWarnings && !quality.hasBlockers;
  const readyForProvider =
    generationDone && quality.completed && !quality.hasBlockers && quality.failCount === 0;

  let statusLabel = "보정 대기";
  let guidance = "지식데이터 생성과 품질점검을 먼저 진행하세요.";
  if (generationFailed) {
    statusLabel = "생성 실패 — 재생성 필요";
    guidance = "생성이 실패했습니다. 전체 재생성을 실행한 뒤 품질점검을 다시 돌리세요.";
  } else if (!generationDone) {
    statusLabel = "생성 완료 후 보정 가능";
    guidance = "생성이 끝나면 품질점검 결과에 따라 보정 경로가 열립니다.";
  } else if (!quality.completed) {
    statusLabel = "품질점검 대기";
    guidance = "품질점검을 실행해 차단/주의 이슈를 확인하세요.";
  } else if (needsCorrection) {
    statusLabel = "관리자 보정 필요";
    guidance =
      "차단 이슈가 있어 제공자 검토로 진행할 수 없습니다. Worker 전체 재생성 후 품질점검을 재실행하세요.";
  } else if (hasWarnings) {
    statusLabel = "관리자 확인 필요";
    guidance = "WARNING이 있습니다. 확인 후 제공자 검토를 요청할 수 있습니다.";
  } else if (readyForProvider) {
    statusLabel = "제공자 검토요청 가능";
    guidance = "품질점검이 통과했습니다. 제공자 검토 단계로 이동하세요.";
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/40 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-slate-900">지식데이터 보정</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-950">
          {statusLabel}
        </span>
      </div>
      <p className="text-xs text-slate-700">{guidance}</p>

      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-amber-100 bg-white px-3 py-2">
          <dt className="text-store-muted">Chunk 개별 수정/비활성화</dt>
          <dd className="mt-0.5 font-semibold text-slate-800">현재 비활성 (API 410)</dd>
        </div>
        <div className="rounded-lg border border-amber-100 bg-white px-3 py-2">
          <dt className="text-store-muted">문서 단위 부분 재생성</dt>
          <dd className="mt-0.5 font-semibold text-slate-800">현재 비활성 (API 410)</dd>
        </div>
        <div className="rounded-lg border border-amber-100 bg-white px-3 py-2">
          <dt className="text-store-muted">전체 재생성</dt>
          <dd className="mt-0.5 font-semibold text-slate-800">Worker ZIP 재실행 가능</dd>
        </div>
        <div className="rounded-lg border border-amber-100 bg-white px-3 py-2">
          <dt className="text-store-muted">품질점검 재실행</dt>
          <dd className="mt-0.5 font-semibold text-slate-800">생성 완료 후 가능</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        {generationFailed || needsCorrection || generationDone ? (
          <button
            type="button"
            onClick={() => onGoGeneration?.()}
            className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
          >
            {generationFailed || needsCorrection ? "재생성 실행으로 이동" : "생성 패널 보기"}
          </button>
        ) : null}
        {generationDone ? (
          <button
            type="button"
            onClick={() => onRerunQuality?.()}
            className="min-h-[40px] rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold text-indigo-950"
          >
            품질점검 재실행
          </button>
        ) : null}
        {readyForProvider ? (
          <button
            type="button"
            onClick={() => {
              if (onGoProviderReview) onGoProviderReview();
              else window.location.assign(`${adminReviewDetailPath(packId)}?step=providerConfirm`);
            }}
            className="min-h-[40px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white"
          >
            제공자 검토 단계로 이동
          </button>
        ) : null}
      </div>
    </section>
  );
}
