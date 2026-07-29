"use client";

import { AdminReviewAcceptTab } from "@/components/AdminReviewAcceptTab";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
import type { AdminWorkerZipPhase } from "@/lib/role-workspace/admin-review-rail";
import type { AdminServiceChannelGatesSnapshot } from "@/lib/role-workspace/admin-service-validation-view-model";
import { buildAdminApprovalPublishViewModel } from "@/lib/role-workspace/admin-approval-publish-view-model";
import { packDetailPath, ROUTES } from "@/lib/routes";
import { UiTooltip } from "@/components/UiTooltip";

/**
 * P6 — Publish workbench: gates + 게시 / 게시 취소 only on the default surface.
 */
export function AdminApprovalPublishWorkbenchPanel({
  packId,
  detail,
  providerConfirmed,
  serviceDone,
  openSupplement,
  quality,
  workerZipPhase,
  channelGates,
  onUpdated,
  onGoGeneration,
  onGoQuality,
  onGoCorrection,
  onGoProviderReview,
  onGoServiceValidation,
}: {
  readonly packId: string;
  readonly detail: AdminReviewDetailDto;
  readonly providerConfirmed: boolean;
  readonly serviceDone: boolean;
  readonly openSupplement: boolean;
  readonly quality: AdminQualityGateSnapshot;
  readonly workerZipPhase: AdminWorkerZipPhase;
  readonly channelGates?: AdminServiceChannelGatesSnapshot | null;
  readonly onUpdated: (next: AdminReviewDetailDto) => void;
  readonly onGoGeneration?: () => void;
  readonly onGoQuality?: () => void;
  readonly onGoCorrection?: () => void;
  readonly onGoProviderReview?: () => void;
  readonly onGoServiceValidation?: () => void;
}) {
  const vm = buildAdminApprovalPublishViewModel({
    detail,
    providerConfirmed,
    serviceDone,
    openSupplement,
    quality,
    workerZipPhase,
    channelGates,
  });

  const showDecisionForm = vm.canDecide && detail.pack.status === "REVIEWING";
  const isPublishedLike = vm.status === "PUBLISHED" || vm.status === "VERIFIED";

  const noCorrection =
    quality.completed && !quality.hasBlockers && quality.failCount === 0;
  const gates = [
    { id: "correction", label: "보정 없음", done: noCorrection && !openSupplement },
    { id: "service", label: "서비스 검증 통과", done: serviceDone },
    { id: "provider", label: "제공자 검토 완료", done: providerConfirmed && !openSupplement },
  ];

  const runRemediation = (id: string) => {
    if (id === "generation") onGoGeneration?.();
    else if (id === "correction") (onGoCorrection ?? onGoQuality)?.();
    else if (id === "publish" || id === "providerConfirm") onGoProviderReview?.();
    else if (id === "serviceValidation" || id === "searchValidation") onGoServiceValidation?.();
  };

  return (
    <div className="space-y-2">
      <section className="space-y-2 border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900">게시</h2>
          <UiTooltip content={vm.summaryMessage}>
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                vm.status === "READY_TO_DECIDE" || isPublishedLike
                  ? "bg-emerald-50 text-emerald-900"
                  : "bg-amber-50 text-amber-950"
              }`}
            >
              {vm.primaryLabel}
            </span>
          </UiTooltip>
        </div>

        <ul className="flex flex-wrap gap-2 text-xs">
          {gates.map((g) => (
            <li
              key={g.id}
              className={`rounded border px-2 py-1 font-semibold ${
                g.done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
            >
              {g.done ? "✓" : "!"} {g.label}
            </li>
          ))}
        </ul>

        {vm.status === "BLOCKED" && vm.remediationActions.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {vm.remediationActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => runRemediation(action.id)}
                className="min-h-[32px] rounded border border-slate-300 bg-white px-2 text-[11px] font-bold text-slate-900"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}

        {isPublishedLike ? (
          <div className="flex flex-wrap gap-2">
            <a
              href={packDetailPath(packId)}
              className="inline-flex min-h-[36px] items-center rounded bg-slate-900 px-3 text-xs font-bold text-white"
            >
              게시됨 · 상세
            </a>
            <a
              href={ROUTES.admin}
              className="inline-flex min-h-[36px] items-center rounded border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
            >
              접수 목록
            </a>
          </div>
        ) : null}
      </section>

      {showDecisionForm ? (
        <div className="border border-slate-200 bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold text-slate-500">
            기본 액션: 게시 · 게시 취소(반려)
          </p>
          <AdminReviewAcceptTab packId={packId} detail={detail} onUpdated={onUpdated} />
        </div>
      ) : !isPublishedLike ? (
        <p className="border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          게시 조건을 충족하면 승인(게시) / 반려(게시 취소)를 진행할 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}
