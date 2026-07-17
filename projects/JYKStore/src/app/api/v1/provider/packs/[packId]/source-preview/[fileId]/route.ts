import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { streamInlinePdfResponse } from "@/lib/distribution/service-validation-source-preview";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { prisma } from "@/lib/prisma";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string; fileId: string }> };

/**
 * Legacy fileId preview — requires runId and binds file.versionId to the run.
 * Prefer /service-validation/{runId}/results/{rank}/source-file for new callers.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, fileId } = await context.params;
  const packIdTrim = packId?.trim() ?? "";
  const fileIdTrim = fileId?.trim() ?? "";
  const runId = request.nextUrl.searchParams.get("runId")?.trim() || "";

  try {
    if (!runId) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_REQUIRED",
        "원문 미리보기에는 runId가 필요합니다.",
        400,
      );
    }
    const profile = await findOrEnsureProviderProfileForUser(userId, clientId);
    if (!profile) {
      throw new PayloadServiceError("PROFILE_REQUIRED", "제공자 프로필이 필요합니다.", 403);
    }
    const pack = await prisma.knowledgePack.findFirst({
      where: { packId: packIdTrim, providerProfileId: profile.id },
    });
    if (!pack) {
      throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
    }

    const run = await prisma.serviceValidationRun.findUnique({ where: { id: runId } });
    if (!run || run.packId !== pack.packId) {
      throw new PayloadServiceError("NOT_FOUND", "검증 실행을 찾을 수 없습니다.", 404);
    }

    const linkedItem = await prisma.serviceValidationResultItem.findFirst({
      where: { runId: run.id },
      select: { id: true },
    });
    if (!linkedItem && run.channel !== "DOWNLOAD") {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
        "검증 결과와 연결된 원문 항목이 없습니다.",
        404,
      );
    }

    const file = await prisma.knowledgePackFile.findFirst({
      where: {
        id: fileIdTrim,
        packId: pack.packId,
        versionId: run.versionId,
        role: "SOURCE_ORIGINAL",
        bundle: {
          isActive: true,
          deletedAt: null,
          storageStatus: "ACTIVE",
        },
      },
    });
    if (!file?.storageKey) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
        "원문 파일이 검증 실행 버전과 일치하지 않습니다.",
        404,
      );
    }

    return await streamInlinePdfResponse({
      storageKey: file.storageKey,
      fileName: file.originalFileName,
      mimeType: file.mimeType || "application/pdf",
      fileSize: Number(file.fileSize),
      rangeHeader: request.headers.get("range"),
    });
  } catch (error) {
    if (error instanceof PayloadServiceError) {
      return jsonWithClientIdCookie(
        { error: error.code, message: error.message },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider/source-preview/file",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/source-preview/[fileId]",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
