import { KnowledgePackFileRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import {
  createDoclingUploadPartPresigns,
  type PartPresignRequest,
} from "@/lib/docling-import/docling-upload-session-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ packId: string; sessionId: string }>;
};

const ROLE_SET = new Set<string>(Object.values(KnowledgePackFileRole));

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, sessionId } = await context.params;

  try {
    const body = (await request.json()) as {
      requests?: Array<{ role?: string; partNumbers?: number[] }>;
    };

    if (!Array.isArray(body.requests) || body.requests.length === 0) {
      return jsonWithClientIdCookie(
        { error: "requests 배열이 필요합니다.", code: "DOCLING_INVALID_PART_NUMBER" },
        clientId,
        { status: 400 },
      );
    }

    const requests: PartPresignRequest[] = [];
    for (const raw of body.requests) {
      if (!raw.role || !ROLE_SET.has(raw.role)) {
        return jsonWithClientIdCookie(
          { error: "알 수 없는 파일 역할입니다.", code: "DOCLING_INVALID_ROLE" },
          clientId,
          { status: 400 },
        );
      }
      if (!Array.isArray(raw.partNumbers) || raw.partNumbers.length === 0) {
        return jsonWithClientIdCookie(
          { error: "partNumbers가 필요합니다.", code: "DOCLING_INVALID_PART_NUMBER" },
          clientId,
          { status: 400 },
        );
      }
      requests.push({
        role: raw.role as KnowledgePackFileRole,
        partNumbers: raw.partNumbers,
      });
    }

    const result = await createDoclingUploadPartPresigns({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      sessionId: sessionId?.trim() ?? "",
      requests,
    });

    // Response includes short-lived presigned URLs — never log them.
    return jsonWithClientIdCookie(
      {
        clientId,
        sessionId: result.sessionId,
        presigns: result.presigns,
      },
      clientId,
    );
  } catch (error) {
    if (isDoclingImportError(error)) {
      return jsonWithClientIdCookie(
        { error: error.message, code: error.code },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider-route",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/docling-import/upload-sessions/[sessionId]/parts",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
