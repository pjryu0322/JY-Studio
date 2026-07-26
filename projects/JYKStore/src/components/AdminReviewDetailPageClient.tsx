"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminReviewAcceptTab } from "@/components/AdminReviewAcceptTab";
import { AdminReviewPageHeader } from "@/components/AdminReviewPageHeader";
import { AdminReviewReceiptInfoCard } from "@/components/AdminReviewReceiptInfoCard";
import { AdminMaterialAcceptancePanel } from "@/components/AdminMaterialAcceptancePanel";
import { AdminKnowledgeCorrectionPanel } from "@/components/AdminKnowledgeCorrectionPanel";
import { AdminKnowledgeGenerationPanel } from "@/components/AdminKnowledgeGenerationPanel";
import { AdminQualityCheckPanel } from "@/components/AdminQualityCheckPanel";
import { AdminProviderReviewPanel } from "@/components/AdminProviderReviewPanel";
import { AdminServiceValidationWorkbenchPanel } from "@/components/AdminServiceValidationWorkbenchPanel";
import { NextActionPanel } from "@/components/role-workspace/NextActionPanel";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  fetchAdminReviewDetail,
  fetchAdminServiceChannelGates,
  fetchAdminStoreWorkflowMarkers,
  fetchAdminWorkerZipRequestState,
  markAdminServiceValidationPassedApi,
  type AdminStoreWorkflowMarkers,
} from "@/lib/admin-review-api";
import {
  isOpenProviderSupplementPhase,
  type ProviderSupplementRequestState,
} from "@/lib/provider-supplement-request";
import { isReviewAccepted } from "@/lib/admin-review-tabs";
import {
  buildAdminQualityGateSnapshot,
  getAdminReviewRailState,
  getNextReviewAction,
  type AdminReviewWorkflowStep,
  type AdminWorkerZipPhase,
} from "@/lib/role-workspace/admin-review-rail";
import type { AdminServiceChannelGatesSnapshot } from "@/lib/role-workspace/admin-service-validation-view-model";

/** null = no explicit ?step (resolve from workflow after load). */
export function parseAdminReviewStep(raw: string | null): AdminReviewWorkflowStep | null {
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
      return null;
  }
}

export function AdminReviewDetailPageClient({ packId }: { readonly packId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedStep = parseAdminReviewStep(searchParams.get("step"));

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
    providerSupplementPhase: "NONE",
    providerSupplement: null,
  });
  const [supplementState, setSupplementState] =
    useState<ProviderSupplementRequestState | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [qualityRefreshKey, setQualityRefreshKey] = useState(0);
  const [channelGates, setChannelGates] = useState<AdminServiceChannelGatesSnapshot | null>(
    null,
  );

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
      if (markers) {
        setWorkflowMarkers(markers);
        setSupplementState(markers.providerSupplement ?? null);
      }
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

  const resolvedWorkflowStep = useMemo(() => {
    const probe = getAdminReviewRailState({
      packId,
      workerZipPhase,
      quality,
      providerReviewPhase: workflowMarkers.providerReviewPhase,
      serviceValidationPhase: workflowMarkers.serviceValidationPhase,
      providerSupplementPhase: workflowMarkers.providerSupplementPhase,
      detail,
      activeStep: requestedStep ?? "queue",
    });
    return probe.currentStep;
  }, [packId, workerZipPhase, quality, workflowMarkers, detail, requestedStep]);

  const activeStep = requestedStep ?? resolvedWorkflowStep;

  useEffect(() => {
    if (loading || requestedStep != null) return;
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("step") === resolvedWorkflowStep) return;
    params.set("step", resolvedWorkflowStep);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [loading, requestedStep, resolvedWorkflowStep, pathname, router, searchParams]);

  const workflow = useMemo(
    () =>
      getAdminReviewRailState({
        packId,
        workerZipPhase,
        quality,
        providerReviewPhase: workflowMarkers.providerReviewPhase,
        serviceValidationPhase: workflowMarkers.serviceValidationPhase,
        providerSupplementPhase: workflowMarkers.providerSupplementPhase,
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

  const showAcceptance = activeStep === "queue";
  const showGenerationWorkbench =
    activeStep === "generation" || activeStep === "quality";
  const showProviderConfirm = activeStep === "providerConfirm";
  const showSearch = activeStep === "searchValidation";
  const showDecision = activeStep === "decision" || activeStep === "publish";
  const providerConfirmed = workflowMarkers.providerReviewPhase === "CONFIRMED";
  const serviceDone = workflowMarkers.serviceValidationPhase === "PASSED";
  const openSupplement = isOpenProviderSupplementPhase(
    workflowMarkers.providerSupplementPhase,
  );
  const generationDone = workerZipPhase === "COMPLETED";

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

      {activeStep !== "queue" && (nextAction.kind !== "NONE" || nextAction.message) ? (
        <NextActionPanel
          action={nextAction}
          onPrimary={() => {
            // Provider review request requires step3 checkboxes — navigate only.
            if (nextAction.kind === "REQUEST_PROVIDER_REVIEW") {
              goStep("providerConfirm");
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

      {showAcceptance ? (
        <AdminMaterialAcceptancePanel
          packId={packId}
          detail={detail}
          onPhaseChange={setWorkerZipPhase}
          onChanged={refreshSilently}
          onGoGeneration={() => goStep("generation")}
        />
      ) : null}

      {showGenerationWorkbench ? (
        <div className="space-y-3">
          <AdminKnowledgeGenerationPanel
            packId={packId}
            onReviewDetailRefresh={refreshSilently}
            onPhaseChange={setWorkerZipPhase}
            qualityRefreshRequestKey={qualityRefreshKey}
            preferQualitySection={activeStep === "quality"}
          />
          <AdminQualityCheckPanel
            quality={quality}
            generationDone={generationDone}
            onRerunQuality={() => {
              goStep("quality");
              setQualityRefreshKey((k) => k + 1);
            }}
            onScrollToQuality={() => {
              goStep("quality");
              requestAnimationFrame(() => {
                document.getElementById("admin-quality-section")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              });
            }}
          />
          <AdminKnowledgeCorrectionPanel
            packId={packId}
            workerZipPhase={workerZipPhase}
            quality={quality}
            onGoGeneration={() => goStep("generation")}
            onRerunQuality={() => {
              goStep("quality");
              setQualityRefreshKey((k) => k + 1);
            }}
            onGoProviderReview={() => goStep("providerConfirm")}
          />
        </div>
      ) : null}

      {showProviderConfirm ? (
        <AdminProviderReviewPanel
          packId={packId}
          detail={detail}
          workerZipPhase={workerZipPhase}
          quality={quality}
          providerReviewPhase={workflowMarkers.providerReviewPhase}
          providerReviewRequestedAt={workflowMarkers.providerReviewRequestedAt}
          providerReviewConfirmedAt={workflowMarkers.providerReviewConfirmedAt}
          supplementState={supplementState}
          onChanged={refreshSilently}
          onGoGeneration={() => goStep("generation")}
          onGoQuality={() => goStep("quality")}
          onError={setError}
        />
      ) : null}

      {showSearch ? (
        <AdminServiceValidationWorkbenchPanel
          packId={packId}
          providerConfirmed={providerConfirmed}
          openSupplement={openSupplement}
          serviceDone={serviceDone}
          actionBusy={actionBusy}
          channelGates={channelGates}
          onGoDecision={() => goStep("decision")}
          onMarkPassed={() => {
            setActionBusy(true);
            void markAdminServiceValidationPassedApi(packId)
              .then(() => refreshSilently())
              .then(() => goStep("decision"))
              .catch((err) =>
                setError(err instanceof Error ? err.message : "서비스 검증 기록에 실패했습니다."),
              )
              .finally(() => setActionBusy(false));
          }}
        />
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
