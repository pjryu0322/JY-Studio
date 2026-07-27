"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminReviewPageHeader } from "@/components/AdminReviewPageHeader";
import { AdminMaterialAcceptancePanel } from "@/components/AdminMaterialAcceptancePanel";
import { AdminKnowledgeCorrectionPanel } from "@/components/AdminKnowledgeCorrectionPanel";
import { AdminKnowledgeGenerationPanel } from "@/components/AdminKnowledgeGenerationPanel";
import { AdminQualityCheckPanel } from "@/components/AdminQualityCheckPanel";
import { AdminProviderReviewPanel } from "@/components/AdminProviderReviewPanel";
import { AdminServiceValidationWorkbenchPanel } from "@/components/AdminServiceValidationWorkbenchPanel";
import { AdminApprovalPublishWorkbenchPanel } from "@/components/AdminApprovalPublishWorkbenchPanel";
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
    case "correction":
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
  const [qualityResultsRevealKey, setQualityResultsRevealKey] = useState(0);
  const [channelRefreshBusy, setChannelRefreshBusy] = useState(false);
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

  const refreshChannelGates = useCallback(async () => {
    setChannelRefreshBusy(true);
    try {
      const gates = await fetchAdminServiceChannelGates(packId);
      setChannelGates(gates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "채널 상태를 새로고침하지 못했습니다.");
    } finally {
      setChannelRefreshBusy(false);
    }
  }, [packId]);

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

  // bindingStatus:
  // 최신 산출물 기준 API/MCP/ZIP 검증을 다시 수행해야 합니다.

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

  if (loading) {
    return <p className="text-sm text-store-muted">불러오는 중…</p>;
  }

  if (!detail) {
    return <p className="text-sm text-red-700">{error ?? "지식팩을 찾을 수 없습니다."}</p>;
  }

  const showAcceptance = activeStep === "queue";
  const showGeneration = activeStep === "generation";
  const showQuality = activeStep === "quality";
  const showCorrection = activeStep === "correction";
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
            else if (nextAction.kind === "REQUEST_PROVIDER_FIX") goStep("correction");
          }}
          onSecondary={() => {
            if (nextAction.secondaryKind === "RERUN_QUALITY") {
              goStep("quality");
              setQualityRefreshKey((k) => k + 1);
            } else if (nextAction.secondaryKind === "REQUEST_PROVIDER_FIX") {
              goStep("correction");
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

      {showGeneration ? (
        <div className="space-y-3">
          <AdminKnowledgeGenerationPanel
            packId={packId}
            onReviewDetailRefresh={refreshSilently}
            onPhaseChange={setWorkerZipPhase}
            workbenchMode="generation"
            onGoQuality={() => goStep("quality")}
          />
        </div>
      ) : null}

      {showQuality ? (
        <div className="space-y-3">
          <AdminKnowledgeGenerationPanel
            packId={packId}
            onReviewDetailRefresh={refreshSilently}
            onPhaseChange={setWorkerZipPhase}
            workbenchMode="quality"
            qualityRefreshRequestKey={qualityRefreshKey}
            qualityResultsRevealKey={qualityResultsRevealKey}
            preferQualitySection
            onGoCorrection={() => goStep("correction")}
            onGoProviderReview={() => goStep("providerConfirm")}
          />
          <AdminQualityCheckPanel
            quality={quality}
            generationDone={generationDone}
            onRerunQuality={() => {
              setQualityRefreshKey((k) => k + 1);
            }}
            onScrollToQuality={() => {
              setQualityResultsRevealKey((k) => k + 1);
            }}
            onGoCorrection={() => goStep("correction")}
            onGoProviderReview={() => goStep("providerConfirm")}
          />
        </div>
      ) : null}

      {showCorrection ? (
        <AdminKnowledgeCorrectionPanel
          packId={packId}
          packName={detail.pack.name}
          detail={detail}
          workerZipPhase={workerZipPhase}
          quality={quality}
          providerReviewPhase={workflowMarkers.providerReviewPhase}
          onGoGeneration={() => goStep("generation")}
          onRerunQuality={() => {
            goStep("quality");
            setQualityRefreshKey((k) => k + 1);
          }}
          onGoProviderReview={() => goStep("providerConfirm")}
          onGoSearchValidation={() => goStep("searchValidation")}
        />
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
          refreshBusy={channelRefreshBusy}
          onRefreshChannels={() => void refreshChannelGates()}
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
        <AdminApprovalPublishWorkbenchPanel
          packId={packId}
          detail={detail}
          providerConfirmed={providerConfirmed}
          serviceDone={serviceDone}
          openSupplement={openSupplement}
          quality={quality}
          workerZipPhase={workerZipPhase}
          channelGates={channelGates}
          onUpdated={(next) => {
            setDetail(next);
          }}
          onGoGeneration={() => goStep("generation")}
          onGoQuality={() => goStep("quality")}
          onGoCorrection={() => goStep("correction")}
          onGoProviderReview={() => goStep("providerConfirm")}
          onGoServiceValidation={() => goStep("searchValidation")}
        />
      ) : null}
    </div>
  );
}
