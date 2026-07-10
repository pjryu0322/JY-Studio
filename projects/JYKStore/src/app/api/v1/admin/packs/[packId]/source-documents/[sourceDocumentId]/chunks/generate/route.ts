import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { generateChunksFromSourceDocument } from "@/lib/chunk-pipeline-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";

type RouteContext = {
  params: Promise<{ packId: string; sourceDocumentId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId, sourceDocumentId } = await context.params;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      maxChunkChars?: number;
      overwriteExisting?: boolean;
    };

    const result = await generateChunksFromSourceDocument({
      packId: packId?.trim() ?? "",
      sourceDocumentId: sourceDocumentId?.trim() ?? "",
      maxChunkChars: body.maxChunkChars,
      overwriteExisting: body.overwriteExisting,
    });

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "원천 문서를 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    if (result.error === "CHUNKS_EXIST") {
      return jsonWithClientIdCookie(
        { error: "이미 생성된 chunk가 있습니다. 덮어쓰기를 선택해 주세요." },
        clientId,
        { status: 409 },
      );
    }
    if (result.error === "VALIDATION") {
      return jsonWithClientIdCookie({ error: result.message }, clientId, { status: 400 });
    }

    return jsonWithClientIdCookie(
      {
        clientId,
        generatedCount: result.generatedCount,
        summary: result.summary,
        chunks: result.chunks,
      },
      clientId,
    );
  } catch (error) {
    logSafeRouteError({ scope: "admin-pack-chunks", method: "POST", path: "/api/v1/admin/packs/[packId]/source-documents/[sourceDocumentId]/chunks/generate", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
