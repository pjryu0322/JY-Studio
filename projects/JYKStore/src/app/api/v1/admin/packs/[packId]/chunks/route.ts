import { NextRequest } from "next/server";
import { createKnowledgeChunk, listPackChunks } from "@/lib/chunk-pipeline-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";

type RouteContext = { params: Promise<{ packId: string }> };

async function parseJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as {
      versionId?: string;
      sourceDocumentId?: string | null;
      chunkType?: string;
      title?: string;
      content?: string;
      section?: string | null;
      tags?: string[];
      metadata?: Record<string, unknown> | null;
      sortOrder?: number;
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;

  try {
    const data = await listPackChunks(packId?.trim() ?? "");
    if (!data) {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    return jsonWithClientIdCookie({ clientId, ...data }, clientId);
  } catch (error) {
    console.error("GET admin chunks failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;

  try {
    const body = await parseJsonBody(request);
    if (!body) {
      return jsonWithClientIdCookie(
        { error: "요청 본문이 올바른 JSON이 아닙니다." },
        clientId,
        { status: 400 },
      );
    }

    const result = await createKnowledgeChunk({
      packId: packId?.trim() ?? "",
      versionId: body.versionId ?? "",
      sourceDocumentId: body.sourceDocumentId,
      chunkType: body.chunkType,
      title: body.title ?? "",
      content: body.content ?? "",
      section: body.section,
      tags: body.tags,
      metadata: body.metadata,
      sortOrder: body.sortOrder,
    });

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    if (result.error === "VERSION_NOT_FOUND" || result.error === "SOURCE_NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "버전 또는 원천 문서를 찾을 수 없습니다." }, clientId, {
        status: 404,
      });
    }
    if (result.error === "VALIDATION") {
      return jsonWithClientIdCookie({ error: result.message }, clientId, { status: 400 });
    }

    return jsonWithClientIdCookie({ clientId, chunk: result.chunk, summary: result.summary }, clientId);
  } catch (error) {
    console.error("POST admin chunks failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
