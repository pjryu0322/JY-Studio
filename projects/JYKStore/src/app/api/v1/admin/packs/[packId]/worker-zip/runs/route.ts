/**
 * P7.5: Admin "Worker 작업 내역" — recent ZIP generation runs for a pack.
 *
 * Lists the recent WORKER_ZIP_IMPORT PipelineRuns (+ their step logs) so an Admin
 * can see what is running now, what completed, and why a past run failed. Gated by
 * `requireAdminSession`. Pack-scoped; a global operations view is a follow-up.
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { listWorkerZipRuns } from "@/lib/python-worker/worker-zip-step-log";
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
    const runs = await listWorkerZipRuns({ packId: trimmedPackId, limit: 10 });
    return jsonWithClientIdCookie(
      { clientId, packId: trimmedPackId, runs },
      clientId,
      { status: 200 },
    );
  } catch (error) {
    logSafeRouteError({
      scope: "admin/worker-zip/runs",
      method: "GET",
      path: "/api/v1/admin/packs/[packId]/worker-zip/runs",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}
