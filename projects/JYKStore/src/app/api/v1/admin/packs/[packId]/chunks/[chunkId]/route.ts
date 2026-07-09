import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { updateKnowledgeChunk } from "@/lib/chunk-pipeline-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";

type RouteContext = { params: Promise<{ packId: string; chunkId: string }> };

async function parseJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as {
      title?: string;
      content?: string;
      section?: string | null;
      tags?: string[];
      metadata?: Record<string, unknown> | null;
      sortOrder?: number;
      isActive?: boolean;
    };
  } catch {
    return null;
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId, chunkId } = await context.params;

  try {
    const body = await parseJsonBody(request);
    if (!body) {
      return jsonWithClientIdCookie(
        { error: "요청 본문이 올바른 JSON이 아닙니다." },
        clientId,
        { status: 400 },
      );
    }

    const result = await updateKnowledgeChunk({
      packId: packId?.trim() ?? "",
      chunkId: chunkId?.trim() ?? "",
      ...body,
    });

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "청크를 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    if (result.error === "VALIDATION") {
      return jsonWithClientIdCookie({ error: result.message }, clientId, { status: 400 });
    }

    return jsonWithClientIdCookie({ clientId, chunk: result.chunk, summary: result.summary }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "admin-pack-chunks", method: "PATCH", path: "/api/v1/admin/packs/[packId]/chunks/[chunkId]", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
