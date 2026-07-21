/**
 * P7.5: Admin "자료 반려" route. Rejects a Worker ZIP generation request (접수 전/후
 * 모두 가능) with a required reason. The original ZIP is preserved and the pack
 * stays DRAFT so the Provider can fix the ZIP and re-request. Running/terminal
 * requests are rejected by the service. Gated by `requireAdminSession`.
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  rejectAdminWorkerZipRequest,
  WorkerZipImportServiceError,
} from "@/lib/python-worker/worker-zip-import-provider-service";
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

  let reason = "";
  try {
    const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
    if (body && typeof body.reason === "string") reason = body.reason;
  } catch {
    // Fall through to the service's empty-reason validation.
  }

  try {
    const result = await rejectAdminWorkerZipRequest({
      adminUserId: adminAuth.adminUserId,
      clientId,
      packId: packId?.trim() ?? "",
      reason,
    });
    return jsonWithClientIdCookie({ clientId, ...result }, clientId, { status: 200 });
  } catch (error) {
    if (error instanceof WorkerZipImportServiceError) {
      return jsonWithClientIdCookie(
        { error: error.message, code: error.code },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "admin/worker-zip/reject",
      method: "POST",
      path: "/api/v1/admin/packs/[packId]/worker-zip/reject",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}
