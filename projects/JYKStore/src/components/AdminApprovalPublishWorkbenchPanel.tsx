"use client";

import { AdminReviewAcceptTab } from "@/components/AdminReviewAcceptTab";
import { AdminReviewReceiptInfoCard } from "@/components/AdminReviewReceiptInfoCard";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
import type { AdminWorkerZipPhase } from "@/lib/role-workspace/admin-review-rail";
import type { AdminServiceChannelGatesSnapshot } from "@/lib/role-workspace/admin-service-validation-view-model";
import { buildAdminApprovalPublishViewModel } from "@/lib/role-workspace/admin-approval-publish-view-model";
import { packDetailPath, ROUTES } from "@/lib/routes";

/**
 * Workbench step5 — 승인·게시.
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

  const runRemediation = (id: string) => {
    if (id === "generation") onGoGeneration?.();
    else if (id === "quality") (onGoQuality ?? onGoGeneration)?.();
    else if (id === "correction") (onGoCorrection ?? onGoQuality)?.();
    else if (id === "providerConfirm") onGoProviderReview?.();
    else if (id === "searchValidation") onGoServiceValidation?.();
  };

  return (
    <div className="space-y-3">
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div>
          <h2 className="text-sm font-bold text-slate-900">승인·게시</h2>
          <p className="mt-1 text-xs text-store-muted">
            최종 게이트를 확인하고 승인 또는 반려를 진행합니다.
          </p>
        </div>

        <div
          className={`rounded-xl border px-3 py-2 text-xs ${
            vm.status === "READY_TO_DECIDE"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : isPublishedLike
                ? "border-slate-200 bg-slate-50 text-slate-800"
                : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          <p className="font-bold">{vm.primaryLabel}</p>
          <p className="mt-0.5">{vm.summaryMessage}</p>
        </div>

        {vm.blockedReasons.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-900">차단 사유</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-amber-950">
              {vm.blockedReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {vm.warnings.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-900">주의</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-amber-900">
              {vm.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-xs font-bold text-slate-900">최종 점검 체크리스트</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {vm.checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    item.done
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-amber-100 text-amber-950"
                  }`}
                >
                  {item.done ? "✓" : "!"}
                </span>
                <span>
                  <span className="font-semibold text-slate-900">{item.label}</span>
                  {item.detail ? (
                    <span className="mt-0.5 block text-store-muted">{item.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {vm.status === "BLOCKED" && vm.remediationActions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {vm.remediationActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => runRemediation(action.id)}
                className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}

        {isPublishedLike ? (
          <div className="flex flex-wrap gap-2">
            <a
              href={ROUTES.admin}
              className="inline-flex min-h-[40px] items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
            >
              지식데이터 접수로 이동
            </a>
            <a
              href={packDetailPath(packId)}
              className="inline-flex min-h-[40px] items-center rounded-xl bg-slate-900 px-3 text-xs font-bold text-white"
            >
              공개 상세 보기
            </a>
          </div>
        ) : null}
      </section>

      {!isPublishedLike ? <AdminReviewReceiptInfoCard detail={detail} /> : null}

      {showDecisionForm ? (
        <AdminReviewAcceptTab packId={packId} detail={detail} onUpdated={onUpdated} />
      ) : !isPublishedLike ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {vm.status === "BLOCKED"
            ? "차단 조건을 해소한 뒤 승인·반려를 진행할 수 있습니다. 위 이동 버튼으로 해당 단계로 돌아가세요."
            : "검수 접수(REVIEWING) 상태이고 최종 게이트를 통과한 경우에만 승인·반려를 진행할 수 있습니다."}
        </p>
      ) : null}
    </div>
  );
}
