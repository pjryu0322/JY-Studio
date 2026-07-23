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
  fetchAdminWorkerZipRequestState,
} from "@/lib/admin-review-api";
import { isReviewAccepted } from "@/lib/admin-review-tabs";
import {
  buildAdminQualityGateSnapshot,
  getAdminReviewRailState,
  getNextReviewAction,
  type AdminReviewWorkflowStep,
  type AdminWorkerZipPhase,
} from "@/lib/role-workspace/admin-review-rail";

function parseStep(raw: string | null): AdminReviewWorkflowStep {
  switch (raw) {
    case "queue":
    case "generation":
    case "quality":
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
  const [searchValidationDone, setSearchValidationDone] = useState(false);
  const [qualityRefreshKey, setQualityRefreshKey] = useState(0);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [data, zip] = await Promise.all([
        fetchAdminReviewDetail(packId),
        fetchAdminWorkerZipRequestState(packId).catch(() => null),
      ]);
      setDetail(data.detail);
      if (zip?.requestStatus) setWorkerZipPhase(zip.requestStatus as AdminWorkerZipPhase);
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
        searchValidationDone,
        detail,
      }),
    [workerZipPhase, quality, searchValidationDone, detail],
  );

  const workflow = useMemo(
    () =>
      getAdminReviewRailState({
        packId,
        workerZipPhase,
        quality,
        searchValidationDone,
        detail,
        activeStep,
      }),
    [packId, workerZipPhase, quality, searchValidationDone, detail, activeStep],
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
    activeStep === "searchValidation";
  const showSearch = activeStep === "searchValidation";
  const showDecision = activeStep === "decision" || activeStep === "publish";

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
      </div>

      {nextAction.kind !== "NONE" || nextAction.message ? (
        <NextActionPanel
          action={nextAction}
          onPrimary={() => {
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

      {showSearch ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div>
            <h2 className="text-sm font-bold text-slate-900">검색데이터 생성·검증</h2>
            <p className="mt-1 text-xs text-store-muted">
              Worker ZIP 경로에서는 지식데이터 생성 시 검색데이터가 함께 반영됩니다. 운영 검증
              내역을 확인하고 다음 단계로 진행하세요.
            </p>
          </div>
          <AdminServiceValidationOpsPanel packId={packId} />
          <button
            type="button"
            onClick={() => {
              setSearchValidationDone(true);
              goStep("decision");
            }}
            className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white"
          >
            검증 확인 완료 · 최종 검수 판단으로 이동
          </button>
        </section>
      ) : null}

      {showDecision ? (
        <>
          {isReviewAccepted(detail) ? <AdminReviewReceiptInfoCard detail={detail} /> : null}
          <AdminReviewAcceptTab packId={packId} detail={detail} onUpdated={setDetail} />
        </>
      ) : null}

      {activeStep === "publish" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-card">
          <p className="font-bold text-slate-900">게시 관리</p>
          <p className="mt-1 text-xs text-store-muted">
            승인·공개 이후 게시 상태와 배포 옵션을 관리합니다. 최종 검수 판단에서 승인하면 이
            단계로 이어집니다.
          </p>
        </section>
      ) : null}
    </div>
  );
}
