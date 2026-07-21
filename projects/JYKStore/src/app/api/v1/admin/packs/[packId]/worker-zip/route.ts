/**
 * P7.3: Admin ZIP Worker execution route — the ONLY place Worker execution is
 * driven for the ZIP path. Gated by `requireAdminSession` so Providers (and
 * plain users) cannot run the generation directly.
 *
 * - GET   → the received request state (attached ZIP, request status, last result)
 *           so the Admin can 접수/확인 before executing.
 * - PATCH → 접수(accept) the request (접수완료). After this the Provider can no longer
 *           withdraw it. The pack stays DRAFT.
 * - POST  → download the Provider-submitted ZIP and run the Worker against the
 *           DRAFT pack. The pack stays DRAFT; promotion to review is a separate
 *           admin step after verification.
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  acceptAdminWorkerZipRequest,
  getProviderWorkerZipRequestState,
  resolveAdminDraftPack,
  runAdminWorkerZipGeneration,
  WorkerZipImportServiceError,
} from "@/lib/python-worker/worker-zip-import-provider-service";
import { mapWorkerZipImportHttpResponse } from "@/lib/python-worker/worker-zip-route-helpers";
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

  try {
    const state = await getProviderWorkerZipRequestState({
      userId: adminAuth.adminUserId,
      clientId,
      packId: packId?.trim() ?? "",
      resolvePack: resolveAdminDraftPack,
    });
    return jsonWithClientIdCookie({ clientId, ...state }, clientId, { status: 200 });
  } catch (error) {
    return mapAdminWorkerZipError(error, clientId, "GET");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

  try {
    const result = await acceptAdminWorkerZipRequest({
      adminUserId: adminAuth.adminUserId,
      clientId,
      packId: packId?.trim() ?? "",
    });
    return jsonWithClientIdCookie({ clientId, ...result }, clientId, { status: 200 });
  } catch (error) {
    return mapAdminWorkerZipError(error, clientId, "PATCH");
  }
}

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

  try {
    const result = await runAdminWorkerZipGeneration({
      adminUserId: adminAuth.adminUserId,
      clientId,
      packId: packId?.trim() ?? "",
    });
    const mapped = mapWorkerZipImportHttpResponse(result);
    return jsonWithClientIdCookie({ clientId, ...mapped.body }, clientId, {
      status: mapped.status,
    });
  } catch (error) {
    return mapAdminWorkerZipError(error, clientId, "POST");
  }
}

function mapAdminWorkerZipError(
  error: unknown,
  clientId: string,
  method: "GET" | "POST" | "PATCH",
) {
  if (error instanceof WorkerZipImportServiceError) {
    return jsonWithClientIdCookie(
      { error: error.message, code: error.code },
      clientId,
      { status: error.httpStatus },
    );
  }
  logSafeRouteError({
    scope: "admin/worker-zip",
    method,
    path: "/api/v1/admin/packs/[packId]/worker-zip",
    error,
  });
  return jsonWithClientIdCookie(
    { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
    clientId,
    { status: 500 },
  );
}
