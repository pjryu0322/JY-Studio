"use client";

import { useState } from "react";
import { AdminServiceValidationOpsPanel } from "@/components/AdminServiceValidationOpsPanel";
import { UiTooltip } from "@/components/UiTooltip";
import {
  buildAdminServiceValidationViewModel,
  resolveAdminServiceValidationUxStatus,
  type AdminServiceChannelGatesSnapshot,
} from "@/lib/role-workspace/admin-service-validation-view-model";

/**
 * P6 — Service Validation workbench: 서비스 가능 / 주의 / 게시 불가 only.
 * Technical channel detail stays behind expand.
 */
export function AdminServiceValidationWorkbenchPanel({
  packId,
  providerConfirmed,
  openSupplement,
  serviceDone,
  actionBusy,
  channelGates,
  onMarkPassed,
  onGoDecision,
  onRefreshChannels,
  refreshBusy,
}: {
  readonly packId: string;
  readonly providerConfirmed: boolean;
  readonly openSupplement: boolean;
  readonly serviceDone: boolean;
  readonly actionBusy: boolean;
  readonly channelGates: AdminServiceChannelGatesSnapshot | null;
  readonly onMarkPassed: () => void;
  readonly onGoDecision?: () => void;
  readonly onRefreshChannels?: () => void;
  readonly refreshBusy?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const vm = buildAdminServiceValidationViewModel({
    providerConfirmed,
    openSupplement,
    serviceDone,
    channelGates,
  });
  const uxStatus = resolveAdminServiceValidationUxStatus(vm);
  const toneClass =
    uxStatus === "서비스 가능"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : uxStatus === "주의"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-red-200 bg-red-50 text-red-900";

  return (
    <section className="space-y-2 border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-slate-900">서비스 검증</h2>
        <UiTooltip content="운영 상태만 표시합니다. 기술 상세는 펼침에서 확인합니다.">
          <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${toneClass}`}>
            {uxStatus}
          </span>
        </UiTooltip>
        {onRefreshChannels ? (
          <button
            type="button"
            disabled={Boolean(refreshBusy)}
            onClick={() => onRefreshChannels()}
            className="ml-auto min-h-[32px] rounded border border-slate-300 bg-white px-2 text-[11px] font-bold text-slate-800 disabled:opacity-60"
          >
            {refreshBusy ? "새로고침…" : "새로고침"}
          </button>
        ) : null}
      </div>

      {vm.summaryMessage ? (
        <p className={`rounded border px-2 py-1.5 text-xs ${toneClass}`}>{vm.summaryMessage}</p>
      ) : null}

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="text-[11px] font-semibold text-slate-500 underline"
      >
        {showDetails ? "상세 숨기기" : "상세 보기"}
      </button>

      {showDetails ? (
        <div className="space-y-2 border border-slate-100 bg-slate-50 p-2">
          <ul className="space-y-1 text-xs">
            {vm.checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <span className="font-bold tabular-nums">{item.done ? "✓" : "!"}</span>
                <span>
                  <span className="font-semibold text-slate-900">{item.label}</span>
                  {item.detail ? (
                    <span className="mt-0.5 block text-store-muted">{item.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <ul className="space-y-1 text-xs">
            {vm.channels.map((ch) => (
              <li key={ch.channel} className="flex justify-between gap-2 border border-white bg-white px-2 py-1">
                <span className="font-semibold text-slate-900">{ch.label}</span>
                <span className={ch.passed ? "text-emerald-700" : "text-amber-800"}>
                  {ch.passed ? "통과" : "미검증"}
                </span>
              </li>
            ))}
          </ul>
          <AdminServiceValidationOpsPanel packId={packId} />
        </div>
      ) : null}

      {vm.status === "DONE" ? (
        <button
          type="button"
          onClick={() => onGoDecision?.()}
          className="min-h-[40px] w-full rounded bg-slate-900 px-3 text-sm font-bold text-white"
        >
          {vm.primaryLabel}
        </button>
      ) : (
        <button
          type="button"
          disabled={!vm.canMarkPassed || actionBusy}
          onClick={() => onMarkPassed()}
          className="min-h-[40px] w-full rounded bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {actionBusy ? "기록 중…" : vm.primaryLabel}
        </button>
      )}
    </section>
  );
}
