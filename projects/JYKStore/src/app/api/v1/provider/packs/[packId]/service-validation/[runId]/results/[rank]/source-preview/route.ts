import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { requireOwnedRunForPreview } from "@/lib/distribution/service-validation-confirmation-service";
import { formatPageLabel } from "@/lib/distribution/service-validation-result-snapshot";
import { prisma } from "@/lib/prisma";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ packId: string; runId: string; rank: string }>;
};

/**
 * Provider source-location preview metadata.
 * Never returns object storage keys.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, runId, rank: rankRaw } = await context.params;
  try {
    const rank = Number.parseInt(rankRaw ?? "", 10);
    if (!Number.isInteger(rank) || rank < 1) {
      return jsonWithClientIdCookie(
        { error: "INVALID_RANK", message: "rank가 올바르지 않습니다." },
        clientId,
        { status: 400 },
      );
    }
    const { item, run } = await requireOwnedRunForPreview({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      runId: runId?.trim() ?? "",
      rank,
    });

    const sourceDoc = await prisma.sourceDocument.findUnique({
      where: { id: item.sourceDocumentId },
      select: { id: true, title: true, fileName: true, mimeType: true },
    });

    // Prefer active SOURCE_ORIGINAL file for the same version (display name only).
    const original = await prisma.knowledgePackFile.findFirst({
      where: {
        versionId: run.versionId,
        role: "SOURCE_ORIGINAL",
        bundle: { isActive: true, deletedAt: null, storageStatus: "ACTIVE" },
      },
      select: { id: true, originalFileName: true, mimeType: true },
      orderBy: { createdAt: "desc" },
    });

    return jsonWithClientIdCookie(
      {
        clientId,
        rank: item.rank,
        title: item.title,
        snippet: item.snippet,
        sourceDocumentTitle:
          item.sourceDocumentTitle ||
          sourceDoc?.title ||
          sourceDoc?.fileName ||
          original?.originalFileName ||
          "원문 문서",
        pageLabel: formatPageLabel(item.pageStart, item.pageEnd),
        pageStart: item.pageStart,
        pageEnd: item.pageEnd,
        fileName: original?.originalFileName ?? sourceDoc?.fileName ?? null,
        mimeLabel: (original?.mimeType || sourceDoc?.mimeType || "")
          .toLowerCase()
          .includes("pdf")
          ? "PDF"
          : "원문",
        previewMode: item.pageStart != null ? "PAGE_HINT" : "TITLE_ONLY",
        // fileId enables existing provider download?preview=1 without exposing objectKey
        previewFileId: original?.id ?? null,
      },
      clientId,
    );
  } catch (error) {
    if (error instanceof PayloadServiceError) {
      return jsonWithClientIdCookie(
        { error: error.code, message: error.message },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider/service-validation/source-preview",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/service-validation/[runId]/results/[rank]/source-preview",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
