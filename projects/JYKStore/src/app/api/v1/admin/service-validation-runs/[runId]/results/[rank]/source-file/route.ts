import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { isPayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  resolveSourceOriginalForValidationResult,
  streamInlinePdfResponse,
} from "@/lib/distribution/service-validation-source-preview";
import { prisma } from "@/lib/prisma";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ runId: string; rank: string }> };

/**
 * Admin inline PDF preview for a historical validation result item.
 */
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
  const { runId, rank: rankRaw } = await context.params;
  try {
    const rank = Number.parseInt(rankRaw ?? "", 10);
    if (!Number.isInteger(rank) || rank < 1) {
      return jsonWithClientIdCookie(
        { error: "INVALID_RANK", message: "rank가 올바르지 않습니다." },
        clientId,
        { status: 400 },
      );
    }
    const run = await prisma.serviceValidationRun.findUnique({
      where: { id: runId?.trim() ?? "" },
      select: { id: true, packId: true },
    });
    if (!run) {
      return jsonWithClientIdCookie(
        { error: "NOT_FOUND", message: "검증 실행을 찾을 수 없습니다." },
        clientId,
        { status: 404 },
      );
    }
    const resolved = await resolveSourceOriginalForValidationResult({
      packId: run.packId,
      runId: run.id,
      rank,
    });
    return await streamInlinePdfResponse({
      storageKey: resolved.storageKey,
      fileName: resolved.fileName,
      mimeType: resolved.mimeType,
      fileSize: resolved.fileSize,
      rangeHeader: request.headers.get("range"),
    });
  } catch (error) {
    if (isPayloadServiceError(error)) {
      return jsonWithClientIdCookie(
        { error: error.code, message: error.message },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "admin/service-validation/source-file",
      method: "GET",
      path: "/api/v1/admin/service-validation-runs/[runId]/results/[rank]/source-file",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
