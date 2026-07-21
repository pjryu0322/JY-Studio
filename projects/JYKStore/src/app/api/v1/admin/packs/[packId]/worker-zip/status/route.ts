/**
 * P7.5: Admin pollable status for the ZIP Worker generation of a pack.
 *
 * The Admin UI polls this (every few seconds, only while a run is active) to
 * render a live stepper: current step, per-step logs, timing, and a completion
 * summary. Backed by the existing PipelineRun + PipelineStepLog rows written
 * during the (synchronous) generation run — no async job queue, no schema change.
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  getProviderWorkerZipRequestState,
  resolveAdminDraftPack,
  WorkerZipImportServiceError,
} from "@/lib/python-worker/worker-zip-import-provider-service";
import { getLatestWorkerZipRun } from "@/lib/python-worker/worker-zip-step-log";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
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
    const [state, run] = await Promise.all([
      getProviderWorkerZipRequestState({
        userId: adminAuth.adminUserId,
        clientId,
        packId: trimmedPackId,
        resolvePack: resolveAdminDraftPack,
      }),
      getLatestWorkerZipRun({ packId: trimmedPackId }),
    ]);

    return jsonWithClientIdCookie(
      {
        clientId,
        packId: trimmedPackId,
        requestStatus: state.requestStatus,
        run,
      },
      clientId,
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof WorkerZipImportServiceError) {
      return jsonWithClientIdCookie(
        { error: error.message, code: error.code },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "admin/worker-zip/status",
      method: "GET",
      path: "/api/v1/admin/packs/[packId]/worker-zip/status",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}
