"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminReviewAcceptTab } from "@/components/AdminReviewAcceptTab";
import { AdminReviewPageHeader } from "@/components/AdminReviewPageHeader";
import { AdminReviewReceiptInfoCard } from "@/components/AdminReviewReceiptInfoCard";
import { AdminServiceValidationOpsPanel } from "@/components/AdminServiceValidationOpsPanel";
import { AdminWorkerZipGenerationCard } from "@/components/AdminWorkerZipGenerationCard";
import { NextActionPanel } from "@/components/role-workspace/NextActionPanel";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  fetchAdminReviewDetail,
  fetchAdminServiceChannelGates,
  fetchAdminStoreWorkflowMarkers,
  fetchAdminWorkerZipRequestState,
  markAdminServiceValidationPassedApi,
  requestAdminProviderReviewApi,
  type AdminStoreWorkflowMarkers,
} from "@/lib/admin-review-api";
import { isReviewAccepted } from "@/lib/admin-review-tabs";
import {
  buildAdminQualityGateSnapshot,
  getAdminReviewRailState,
  getNextReviewAction,
  type AdminReviewWorkflowStep,
  type AdminWorkerZipPhase,
} from "@/lib/role-workspace/admin-review-rail";
import { canRequestProviderReviewHandoff } from "@/lib/store-workflow-handoff-gates-policy";

function parseStep(raw: string | null): AdminReviewWorkflowStep {
  switch (raw) {
    case "queue":
    case "generation":
    case "quality":
    case "providerConfirm":
    case "searchValidation":
    case "decision":
    case "publish":
    case "ops":
      return raw;
    default:
      return "generation";
  }
}

export function AdminReviewDetailPageClient({ packId }: { readonly packId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeStep = parseStep(searchParams.get("step"));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminReviewDetailDto | null>(null);
  const [workerZipPhase, setWorkerZipPhase] = useState<AdminWorkerZipPhase>("NONE");
  const [workflowMarkers, setWorkflowMarkers] = useState<AdminStoreWorkflowMarkers>({
    providerReviewPhase: "NONE",
    serviceValidationPhase: "NONE",
    providerReviewRequestedAt: null,
    providerReviewConfirmedAt: null,
    serviceValidationPassedAt: null,
  });
  const [actionBusy, setActionBusy] = useState(false);
  const [qualityRefreshKey, setQualityRefreshKey] = useState(0);
  const [channelGates, setChannelGates] = useState<{
    allPassed: boolean;
    serviceValidationReady?: boolean;
    bindingStatus?: string;
    bindingReason?: string | null;
    channels: Array<{
      channel: string;
      label: string;
      passed: boolean;
      reason: string | null;
      reasonCode?: string | null;
    }>;
    missingLabels: string[];
  } | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [data, zip, markers, gates] = await Promise.all([
        fetchAdminReviewDetail(packId),
        fetchAdminWorkerZipRequestState(packId).catch(() => null),
        fetchAdminStoreWorkflowMarkers(packId).catch(() => null),
        fetchAdminServiceChannelGates(packId).catch(() => null),
      ]);
      setDetail(data.detail);
      if (zip?.requestStatus) setWorkerZipPhase(zip.requestStatus as AdminWorkerZipPhase);
      if (markers) setWorkflowMarkers(markers);
      if (gates) setChannelGates(gates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검수 상세를 불러오지 못했습니다.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshSilently = useCallback(() => refresh({ silent: true }), [refresh]);

  const goStep = useCallback(
    (step: AdminReviewWorkflowStep) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", step);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const quality = useMemo(() => buildAdminQualityGateSnapshot(detail), [detail]);

  const nextAction = useMemo(
    () =>
      getNextReviewAction({
        workerZipPhase,
        quality,
        providerReviewPhase: workflowMarkers.providerReviewPhase,
        serviceValidationPhase: workflowMarkers.serviceValidationPhase,
        detail,
      }),
    [workerZipPhase, quality, workflowMarkers, detail],
  );

  const workflow = useMemo(
    () =>
      getAdminReviewRailState({
        packId,
        workerZipPhase,
        quality,
        providerReviewPhase: workflowMarkers.providerReviewPhase,
        serviceValidationPhase: workflowMarkers.serviceValidationPhase,
        detail,
        activeStep,
      }),
    [packId, workerZipPhase, quality, workflowMarkers, detail, activeStep],
  );

  if (loading) {
    return <p className="text-sm text-store-muted">불러오는 중…</p>;
  }

  if (!detail) {
    return <p className="text-sm text-red-700">{error ?? "지식팩을 찾을 수 없습니다."}</p>;
  }

  const showGeneration =
    activeStep === "queue" ||
    activeStep === "generation" ||
    activeStep === "quality" ||
    activeStep === "providerConfirm";
  const showProviderConfirm = activeStep === "providerConfirm";
  const showSearch = activeStep === "searchValidation";
  const showDecision = activeStep === "decision" || activeStep === "publish";
  const providerConfirmed = workflowMarkers.providerReviewPhase === "CONFIRMED";
  const serviceDone = workflowMarkers.serviceValidationPhase === "PASSED";
  const canRequestProviderReview = canRequestProviderReviewHandoff({
    workerZipPhase,
    quality,
    providerReviewPhase: workflowMarkers.providerReviewPhase,
  });
  const channelsReady = Boolean(channelGates?.allPassed);

  return (
    <div className="min-w-0 space-y-4">
      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <AdminReviewPageHeader detail={detail} />

      <div className="rounded-2xl border border-store-border bg-white px-4 py-3 text-xs text-slate-700 shadow-card">
        <p>
          <span className="font-semibold text-slate-900">현재 단계:</span>{" "}
          {workflow.items.find((i) => i.status === "current")?.label ?? "-"}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-slate-900">다음 단계:</span>{" "}
          {workflow.items.find((i) => i.status === "next")?.label ??
            workflow.items.find((i) => i.status === "current")?.label ??
            "-"}
        </p>
        <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="검수 단계">
          {workflow.items
            .filter((item) => item.id !== "ops")
            .map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.status === "blocked"}
                onClick={() => goStep(item.id as AdminReviewWorkflowStep)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  item.status === "current"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : item.status === "blocked"
                      ? "border-slate-200 text-slate-400"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                title={item.blockedReason}
              >
                {item.label}
              </button>
            ))}
        </nav>
      </div>

      {nextAction.kind !== "NONE" || nextAction.message ? (
        <NextActionPanel
          action={nextAction}
          onPrimary={() => {
            if (nextAction.kind === "REQUEST_PROVIDER_REVIEW") {
              setActionBusy(true);
              void requestAdminProviderReviewApi(packId)
                .then(() => refreshSilently())
                .then(() => goStep("providerConfirm"))
                .catch((err) =>
                  setError(err instanceof Error ? err.message : "제공자 확인 요청에 실패했습니다."),
                )
                .finally(() => setActionBusy(false));
              return;
            }
            if (nextAction.kind === "GO_SEARCH_VALIDATION") goStep("searchValidation");
            else if (nextAction.kind === "GO_FINAL_DECISION") goStep("decision");
            else if (nextAction.kind === "REGENERATE_KNOWLEDGE") goStep("generation");
            else if (nextAction.kind === "REQUEST_PROVIDER_FIX") goStep("generation");
          }}
          onSecondary={() => {
            if (nextAction.secondaryKind === "RERUN_QUALITY") {
              goStep("quality");
              setQualityRefreshKey((k) => k + 1);
            } else if (nextAction.secondaryKind === "REQUEST_PROVIDER_FIX") {
              goStep("generation");
            }
          }}
        />
      ) : null}

      {showGeneration ? (
        <AdminWorkerZipGenerationCard
          packId={packId}
          onReviewDetailRefresh={refreshSilently}
          onPhaseChange={setWorkerZipPhase}
          qualityRefreshRequestKey={qualityRefreshKey}
          preferQualitySection={activeStep === "quality"}
        />
      ) : null}

      {showProviderConfirm ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div>
            <h2 className="text-sm font-bold text-slate-900">제공자 확인</h2>
            <p className="mt-1 text-xs text-store-muted">
              지식데이터 생성 완료와 품질점검 통과 후 제공자에게 생성 결과 검토를 요청합니다. 제공자
              확인 전에는 서비스 검증·공개로 진행할 수 없습니다.
            </p>
          </div>
          {workerZipPhase !== "COMPLETED" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              지식데이터 생성이 완료되지 않아 제공자 확인을 요청할 수 없습니다. (현재:{" "}
              {workerZipPhase})
            </p>
          ) : null}
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <dt className="text-store-muted">제공자 검토 상태</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {workflowMarkers.providerReviewPhase}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <dt className="text-store-muted">요청/확인 시각</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {workflowMarkers.providerReviewConfirmedAt ??
                  workflowMarkers.providerReviewRequestedAt ??
                  "-"}
              </dd>
            </div>
          </dl>
          {workflowMarkers.providerReviewPhase === "NONE" ? (
            <button
              type="button"
              disabled={actionBusy || !canRequestProviderReview}
              onClick={() => {
                setActionBusy(true);
                void requestAdminProviderReviewApi(packId)
                  .then(() => refreshSilently())
                  .catch((err) =>
                    setError(
                      err instanceof Error ? err.message : "제공자 확인 요청에 실패했습니다.",
                    ),
                  )
                  .finally(() => setActionBusy(false));
              }}
              className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white disabled:opacity-60"
            >
              제공자 확인 요청
            </button>
          ) : null}
        </section>
      ) : null}

      {showSearch ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div>
            <h2 className="text-sm font-bold text-slate-900">서비스 검증</h2>
            <p className="mt-1 text-xs text-store-muted">
              API·MCP·ZIP/RAG Export 동작과 검색 품질 샘플을 확인합니다. 제공자 확인 완료 후에만
              검증 완료를 기록할 수 있습니다.
            </p>
          </div>
          {!providerConfirmed ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              제공자 확인이 완료되지 않아 서비스 검증 완료를 기록할 수 없습니다.
            </p>
          ) : null}
          {providerConfirmed && channelGates && channelGates.bindingStatus !== "CURRENT" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {channelGates.bindingReason ??
                "최신 지식데이터 기준 API/MCP/ZIP 검증이 필요합니다."}
            </p>
          ) : null}
          {providerConfirmed && channelGates && !channelGates.allPassed ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-semibold">미검증 채널</p>
              <ul className="mt-1 list-disc pl-4">
                {channelGates.channels
                  .filter((c) => !c.passed)
                  .map((c) => (
                    <li key={c.channel}>
                      {c.label}
                      {c.reason ? ` — ${c.reason}` : ""}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          {providerConfirmed && channelsReady ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              API·MCP·ZIP/RAG Export 검증이 모두 통과했습니다.
            </p>
          ) : null}
          <AdminServiceValidationOpsPanel packId={packId} />
          <button
            type="button"
            disabled={!providerConfirmed || !channelsReady || serviceDone || actionBusy}
            onClick={() => {
              setActionBusy(true);
              void markAdminServiceValidationPassedApi(packId)
                .then(() => refreshSilently())
                .then(() => goStep("decision"))
                .catch((err) =>
                  setError(err instanceof Error ? err.message : "서비스 검증 기록에 실패했습니다."),
                )
                .finally(() => setActionBusy(false));
            }}
            className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {serviceDone
              ? "서비스 검증 완료됨 · 최종 검수 판단으로 이동"
              : "검증 확인 완료 · 최종 검수 판단으로 이동"}
          </button>
        </section>
      ) : null}

      {showDecision ? (
        <>
          {!serviceDone || !providerConfirmed ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              제공자 확인과 서비스 검증이 완료된 뒤에 최종 승인·공개를 진행하세요.
            </p>
          ) : null}
          <AdminReviewReceiptInfoCard detail={detail} />
          <AdminReviewAcceptTab
            packId={packId}
            detail={detail}
            onUpdated={(next) => {
              setDetail(next);
              if (isReviewAccepted(next)) {
                // keep decision step
              }
            }}
          />
        </>
      ) : null}
    </div>
  );
}
