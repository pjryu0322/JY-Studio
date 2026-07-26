"use client";

import { AdminServiceValidationOpsPanel } from "@/components/AdminServiceValidationOpsPanel";
import {
  buildAdminServiceValidationViewModel,
  type AdminServiceChannelGatesSnapshot,
} from "@/lib/role-workspace/admin-service-validation-view-model";

/**
 * Workbench step4 — 서비스 검증.
 * Channel readiness + ops tools + mark-passed CTA.
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
  const vm = buildAdminServiceValidationViewModel({
    providerConfirmed,
    openSupplement,
    serviceDone,
    channelGates,
  });

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div>
        <h2 className="text-sm font-bold text-slate-900">서비스 검증</h2>
        <p className="mt-1 text-xs text-store-muted">
          API·MCP·RAG Export 채널이 최신 Worker 산출물 기준으로 검증됐는지 확인합니다.
        </p>
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-900">완료 조건 체크리스트</p>
          {onRefreshChannels ? (
            <button
              type="button"
              disabled={Boolean(refreshBusy)}
              onClick={() => onRefreshChannels()}
              className="min-h-[32px] rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-bold text-slate-800 disabled:opacity-60"
            >
              {refreshBusy ? "새로고침 중…" : "채널 상태 새로고침"}
            </button>
          ) : null}
        </div>
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
        <p className="mt-2 text-[11px] text-store-muted">{vm.howToRunHint}</p>
      </div>

      {vm.blockedReasons.length > 0 ? (
        <div className="space-y-2">
          {vm.blockedReasons.map((reason) => (
            <p
              key={reason}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              {reason}
            </p>
          ))}
        </div>
      ) : null}

      {vm.summaryMessage && vm.status === "READY" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {vm.summaryMessage}
        </p>
      ) : null}

      {vm.status === "DONE" && vm.summaryMessage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {vm.summaryMessage}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
        <p className="text-xs font-bold text-slate-900">채널별 검증 현황</p>
        {vm.channels.length === 0 ? (
          <p className="mt-2 text-xs text-store-muted">채널 상태를 불러오는 중이거나 아직 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {vm.channels.map((ch) => (
              <li
                key={ch.channel}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-white bg-white px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-900">{ch.label}</p>
                  {ch.reason ? (
                    <p className="mt-0.5 text-store-muted">{ch.reason}</p>
                  ) : null}
                  {ch.reasonCode ? (
                    <p className="mt-0.5 font-mono text-[10px] text-slate-500">{ch.reasonCode}</p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    ch.passed
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-amber-100 text-amber-950"
                  }`}
                >
                  {ch.passed ? "통과" : "미검증"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {vm.bindingStatus ? (
          <p className="mt-2 text-[11px] text-store-muted">
            바인딩: {vm.bindingStatus}
            {vm.bindingReason ? ` — ${vm.bindingReason}` : ""}
          </p>
        ) : null}
      </div>

      <AdminServiceValidationOpsPanel packId={packId} />

      {vm.status === "DONE" ? (
        <button
          type="button"
          onClick={() => onGoDecision?.()}
          className="min-h-[44px] w-full rounded-xl bg-slate-900 px-3 text-sm font-bold text-white"
        >
          {vm.primaryLabel}
        </button>
      ) : (
        <button
          type="button"
          disabled={!vm.canMarkPassed || actionBusy}
          onClick={() => onMarkPassed()}
          className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {actionBusy ? "기록 중…" : vm.primaryLabel}
        </button>
      )}
    </section>
  );
}
