"use client";

import { useState } from "react";
import { AdminReviewAcceptTab } from "@/components/AdminReviewAcceptTab";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  restorePublishAdminReview,
  unpublishAdminReview,
} from "@/lib/admin-review-api";
import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
import type { AdminWorkerZipPhase } from "@/lib/role-workspace/admin-review-rail";
import type { AdminServiceChannelGatesSnapshot } from "@/lib/role-workspace/admin-service-validation-view-model";
import { buildAdminApprovalPublishViewModel } from "@/lib/role-workspace/admin-approval-publish-view-model";
import { packDetailPath, ROUTES } from "@/lib/routes";
import { UiTooltip } from "@/components/UiTooltip";

/**
 * P6/P9 — Publish workbench: gates + 게시 / 게시 취소(반려) / 게시 중단 / 재게시.
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
  const [lifecycleBusy, setLifecycleBusy] = useState<"unpublish" | "restore" | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);

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
  const canRestorePublish =
    detail.pack.status === "DRAFT" &&
    serviceDone &&
    providerConfirmed &&
    !openSupplement;

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

  const onUnpublish = async () => {
    setLifecycleError(null);
    setLifecycleBusy("unpublish");
    try {
      const res = await unpublishAdminReview(packId, {
        memo: "게시 중단(공개 회수)",
      });
      onUpdated(res.detail);
    } catch (error) {
      setLifecycleError(error instanceof Error ? error.message : "게시 중단에 실패했습니다.");
    } finally {
      setLifecycleBusy(null);
    }
  };

  const onRestorePublish = async () => {
    setLifecycleError(null);
    setLifecycleBusy("restore");
    try {
      const res = await restorePublishAdminReview(packId, {
        memo: "게시 취소 후 재게시",
      });
      onUpdated(res.detail);
    } catch (error) {
      setLifecycleError(error instanceof Error ? error.message : "재게시에 실패했습니다.");
    } finally {
      setLifecycleBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <section className="space-y-2 border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900">게시</h2>
          <UiTooltip content={vm.summaryMessage}>
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                vm.status === "READY_TO_DECIDE" || isPublishedLike || canRestorePublish
                  ? "bg-emerald-50 text-emerald-900"
                  : "bg-amber-50 text-amber-950"
              }`}
            >
              {canRestorePublish && !isPublishedLike ? "재게시 가능" : vm.primaryLabel}
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
            <button
              type="button"
              disabled={lifecycleBusy !== null}
              onClick={() => void onUnpublish()}
              className="inline-flex min-h-[36px] items-center rounded border border-slate-400 bg-white px-3 text-xs font-bold text-slate-900 disabled:opacity-50"
            >
              {lifecycleBusy === "unpublish" ? "중단 중…" : "게시 중단"}
            </button>
          </div>
        ) : null}

        {canRestorePublish ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={lifecycleBusy !== null}
              onClick={() => void onRestorePublish()}
              className="inline-flex min-h-[36px] items-center rounded bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-50"
            >
              {lifecycleBusy === "restore" ? "재게시 중…" : "재게시"}
            </button>
            <p className="w-full text-[11px] text-slate-600">
              게시 중단 후 DRAFT입니다. 보존된 PRODUCTION 세대를 유지한 채 공개 서빙을 복원합니다.
            </p>
          </div>
        ) : null}

        {lifecycleError ? (
          <p className="border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-900">
            {lifecycleError}
          </p>
        ) : null}
      </section>

      {showDecisionForm ? (
        <div className="border border-slate-200 bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold text-slate-500">
            기본 액션: 게시 · 게시 취소(반려)
          </p>
          <AdminReviewAcceptTab packId={packId} detail={detail} onUpdated={onUpdated} />
        </div>
      ) : !isPublishedLike && !canRestorePublish ? (
        <p className="border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          게시 조건을 충족하면 승인(게시) / 반려(게시 취소)를 진행할 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}
