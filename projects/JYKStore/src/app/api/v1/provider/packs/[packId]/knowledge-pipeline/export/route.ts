import { NextRequest, NextResponse } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { buildContentDisposition } from "@/lib/distribution/content-disposition";
import {
  exportDoclingKnowledgePipelineStage,
  isDoclingKnowledgeExportStageId,
} from "@/lib/docling-knowledge/docling-knowledge-export";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;
  const stageRaw = request.nextUrl.searchParams.get("stage")?.trim() ?? "";

  if (!isDoclingKnowledgeExportStageId(stageRaw)) {
    return jsonWithClientIdCookie(
      {
        error: "INVALID_STAGE",
        message:
          "stage 쿼리가 필요합니다. STRUCTURE | KNOWLEDGE_UNIT | RETRIEVAL_CHUNK | SEARCH_INDEX | RETRIEVAL_EVALUATION",
      },
      clientId,
      { status: 400 },
    );
  }

  try {
    const result = await exportDoclingKnowledgePipelineStage({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      stageId: stageRaw,
    });
    if ("error" in result) {
      const status =
        result.error === "NOT_FOUND"
          ? 404
          : result.error === "PROFILE_REQUIRED"
            ? 403
            : result.error === "INVALID_STAGE"
              ? 400
              : 409;
      return jsonWithClientIdCookie(
        { error: result.error, message: result.message },
        clientId,
        { status },
      );
    }

    return new NextResponse(result.body, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": buildContentDisposition(result.fileName),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logSafeRouteError({
      scope: "provider/knowledge-pipeline/export",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/knowledge-pipeline/export",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
