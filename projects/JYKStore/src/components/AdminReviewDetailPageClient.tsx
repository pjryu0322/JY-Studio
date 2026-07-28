"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminReviewPageHeader } from "@/components/AdminReviewPageHeader";
import { AdminMaterialAcceptancePanel } from "@/components/AdminMaterialAcceptancePanel";
import { AdminKnowledgeScopePanel } from "@/components/AdminKnowledgeScopePanel";
import { AdminKnowledgeCorrectionPanel } from "@/components/AdminKnowledgeCorrectionPanel";
import { AdminKnowledgeGenerationPanel } from "@/components/AdminKnowledgeGenerationPanel";
import { AdminQualityCheckPanel } from "@/components/AdminQualityCheckPanel";
import { AdminProviderReviewPanel } from "@/components/AdminProviderReviewPanel";
import { AdminServiceValidationWorkbenchPanel } from "@/components/AdminServiceValidationWorkbenchPanel";
import { AdminApprovalPublishWorkbenchPanel } from "@/components/AdminApprovalPublishWorkbenchPanel";
import { NextActionPanel } from "@/components/role-workspace/NextActionPanel";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  fetchAdminKnowledgeScope,
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
  type AdminWorkerZipPhase,
} from "@/lib/role-workspace/admin-review-rail";
import type { AdminServiceChannelGatesSnapshot } from "@/lib/role-workspace/admin-service-validation-view-model";
import {
  resolveAdminWorkflowStepQuery,
  type AdminWorkflowStep,
} from "@/lib/workflow";
import { ROUTES as APP_ROUTES } from "@/lib/routes";

/** null = no explicit ?step (resolve from workflow after load). ops → external. */
export function parseAdminReviewStep(raw: string | null): AdminWorkflowStep | null {
  if (raw === "ops") return null;
  return resolveAdminWorkflowStepQuery(raw);
}

export function AdminReviewDetailPageClient({ packId }: { readonly packId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawStep = searchParams.get("step");
  const requestedStep = parseAdminReviewStep(rawStep);

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
  const [knowledgeScopeReady, setKnowledgeScopeReady] = useState(false);

  useEffect(() => {
    if (rawStep === "ops") {
      router.replace(APP_ROUTES.adminOps);
    }
  }, [rawStep, router]);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [detailData, zip, markers, gates, scope] = await Promise.all([
        fetchAdminReviewDetail(packId),
        fetchAdminWorkerZipRequestState(packId).catch(() => null),
        fetchAdminStoreWorkflowMarkers(packId).catch(() => null),
        fetchAdminServiceChannelGates(packId).catch(() => null),
        fetchAdminKnowledgeScope(packId).catch(() => null),
      ]);
      setDetail(detailData.detail);
      if (zip?.requestStatus) setWorkerZipPhase(zip.requestStatus as AdminWorkerZipPhase);
      if (markers) {
        setWorkflowMarkers(markers);
        setSupplementState(markers.providerSupplement ?? null);
      }
      if (gates) setChannelGates(gates);
      if (scope) setKnowledgeScopeReady(scope.readyForGeneration);
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
    (step: AdminWorkflowStep) => {
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
        providerSupplementPhase: workflowMarkers.providerSupplementPhase,
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
      activeStep: requestedStep ?? "receipt",
      knowledgeScopeReady,
    });
    return probe.currentStep;
  }, [
    packId,
    workerZipPhase,
    quality,
    workflowMarkers,
    detail,
    requestedStep,
    knowledgeScopeReady,
  ]);

  const activeStep = requestedStep ?? resolvedWorkflowStep;

  useEffect(() => {
    if (loading || requestedStep != null || rawStep === "ops") return;
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("step") === resolvedWorkflowStep) return;
    params.set("step", resolvedWorkflowStep);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [
    loading,
    requestedStep,
    resolvedWorkflowStep,
    pathname,
    router,
    searchParams,
    rawStep,
  ]);

  if (loading) {
    return <p className="text-sm text-store-muted">불러오는 중…</p>;
  }

  if (!detail) {
    return <p className="text-sm text-red-700">{error ?? "지식팩을 찾을 수 없습니다."}</p>;
  }

  const showReceipt = activeStep === "receipt";
  const showScope = activeStep === "knowledgeScope";
  const showGeneration = activeStep === "generation";
  const showCorrection = activeStep === "correction";
  const showService = activeStep === "serviceValidation";
  const showPublish = activeStep === "publish";
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

      {activeStep !== "receipt" && (nextAction.kind !== "NONE" || nextAction.message) ? (
        <NextActionPanel
          action={nextAction}
          onPrimary={() => {
            if (nextAction.kind === "REQUEST_PROVIDER_REVIEW") {
              goStep("publish");
              return;
            }
            if (nextAction.kind === "GO_SERVICE_VALIDATION") goStep("serviceValidation");
            else if (nextAction.kind === "GO_FINAL_DECISION") goStep("publish");
            else if (nextAction.kind === "REGENERATE_KNOWLEDGE") goStep("generation");
            else if (nextAction.kind === "REQUEST_PROVIDER_FIX") goStep("correction");
            else if (nextAction.kind === "RERUN_QUALITY") {
              goStep("generation");
              setQualityRefreshKey((k) => k + 1);
            }
          }}
          onSecondary={() => {
            if (nextAction.secondaryKind === "RERUN_QUALITY") {
              goStep("generation");
              setQualityRefreshKey((k) => k + 1);
            } else if (nextAction.secondaryKind === "REQUEST_PROVIDER_FIX") {
              goStep("correction");
            }
          }}
        />
      ) : null}

      {showReceipt ? (
        <AdminMaterialAcceptancePanel
          packId={packId}
          detail={detail}
          onPhaseChange={setWorkerZipPhase}
          onChanged={refreshSilently}
          onGoGeneration={() => goStep("knowledgeScope")}
        />
      ) : null}

      {showScope ? (
        <AdminKnowledgeScopePanel
          packId={packId}
          packName={detail.pack.name}
          onScopeReadyChange={setKnowledgeScopeReady}
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
            qualityRefreshRequestKey={qualityRefreshKey}
            qualityResultsRevealKey={qualityResultsRevealKey}
            preferQualitySection={generationDone}
            onGoQuality={() => {
              setQualityResultsRevealKey((k) => k + 1);
            }}
            onGoCorrection={() => goStep("correction")}
            onGoProviderReview={() => goStep("serviceValidation")}
          />
          {generationDone ? (
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
              onGoProviderReview={() => goStep("serviceValidation")}
            />
          ) : null}
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
            goStep("generation");
            setQualityRefreshKey((k) => k + 1);
          }}
          onGoProviderReview={() => goStep("serviceValidation")}
          onGoSearchValidation={() => goStep("serviceValidation")}
        />
      ) : null}

      {showService ? (
        <AdminServiceValidationWorkbenchPanel
          packId={packId}
          providerConfirmed={true}
          openSupplement={openSupplement}
          serviceDone={serviceDone}
          actionBusy={actionBusy}
          channelGates={channelGates}
          refreshBusy={channelRefreshBusy}
          onRefreshChannels={() => void refreshChannelGates()}
          onGoDecision={() => goStep("publish")}
          onMarkPassed={() => {
            setActionBusy(true);
            void markAdminServiceValidationPassedApi(packId)
              .then(() => refreshSilently())
              .then(() => goStep("publish"))
              .catch((err) =>
                setError(err instanceof Error ? err.message : "서비스 검증 기록에 실패했습니다."),
              )
              .finally(() => setActionBusy(false));
          }}
        />
      ) : null}

      {showPublish ? (
        <div className="space-y-3">
          {!providerConfirmed ? (
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
              onGoQuality={() => goStep("generation")}
              onError={setError}
            />
          ) : null}
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
              void refreshSilently();
            }}
            onGoGeneration={() => goStep("generation")}
            onGoQuality={() => goStep("generation")}
            onGoCorrection={() => goStep("correction")}
            onGoProviderReview={() => goStep("publish")}
            onGoServiceValidation={() => goStep("serviceValidation")}
          />
        </div>
      ) : null}
    </div>
  );
}
