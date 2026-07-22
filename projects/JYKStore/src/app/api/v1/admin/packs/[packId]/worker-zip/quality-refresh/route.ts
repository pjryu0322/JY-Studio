/**
 * Admin: run legacy quality gates against a Worker ZIP pack so "판단 근거"
 * reflects real source-validation / structure / chunk / retrieval reports.
 *
 * Separate from knowledge generation — generation stays fast to READY; quality
 * refresh is an explicit Admin step (can take minutes on large packs).
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { refreshWorkerZipReviewReadiness } from "@/lib/python-worker/worker-zip-quality-refresh-service";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminAuth = await requireAdminSession(request, clientId);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }
  const { packId } = await context.params;
  const trimmedPackId = packId?.trim() ?? "";

  try {
    const result = await refreshWorkerZipReviewReadiness({
      packId: trimmedPackId,
      reviewerClientId: clientId,
    });
    if (!result.ok) {
      const status = result.error === "NOT_FOUND" ? 404 : 409;
      return jsonWithClientIdCookie(
        { ok: false, error: result.error, message: result.message },
        clientId,
        { status },
      );
    }

    const { refresh, backfilledSourceDocuments, retypedSourceDocuments } = result;
    return jsonWithClientIdCookie(
      {
        ok: true,
        clientId,
        packId: trimmedPackId,
        backfilledSourceDocuments,
        retypedSourceDocuments,
        stepsCompleted: refresh.stepsCompleted,
        warnings: refresh.warnings,
        stoppedAt: refresh.stoppedAt,
        readiness: {
          sourceValidation: refresh.detail.readiness.sourceValidation,
          structureCoverageStatus: refresh.detail.readiness.structureCoverageStatus,
          knowledgeQualityStatus: refresh.detail.readiness.knowledgeQualityStatus,
          structureQualityMessage: refresh.detail.readiness.structureQualityMessage,
          chunkQualityStatus: refresh.detail.readiness.chunkQualityStatus,
          chunkQualityMessage: refresh.detail.readiness.chunkQualityMessage,
          retrievalEvaluationStatus: refresh.detail.readiness.retrievalEvaluationStatus,
          retrievalEvaluationMessage: refresh.detail.readiness.retrievalEvaluationMessage,
          releaseGateStatus: refresh.detail.readiness.releaseGateStatus,
          releaseGateMessage: refresh.detail.readiness.releaseGateMessage,
        },
      },
      clientId,
      { status: 200 },
    );
  } catch (error) {
    logSafeRouteError({
      scope: "admin/worker-zip/quality-refresh",
      method: "POST",
      path: "/api/v1/admin/packs/[packId]/worker-zip/quality-refresh",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}
