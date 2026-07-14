import { KnowledgePackFileRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import {
  createDoclingUploadSession,
  type UploadSessionFileInput,
} from "@/lib/docling-import/docling-upload-session-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

const ROLE_SET = new Set<string>(Object.values(KnowledgePackFileRole));

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  console.info(`[docling-upload] pack=${packId} event=session_create_request`);
  try {
    const body = (await request.json()) as {
      files?: Array<{
        role?: string;
        fileName?: string;
        mimeType?: string | null;
        declaredFileSize?: number;
        lastModifiedMs?: number | null;
        headSha256?: string | null;
        tailSha256?: string | null;
      }>;
    };

    if (!Array.isArray(body.files) || body.files.length === 0) {
      return jsonWithClientIdCookie(
        {
          error: "files 배열이 필요합니다.",
          code: "DOCLING_FILE_REQUIRED",
        },
        clientId,
        { status: 400 },
      );
    }

    const files: UploadSessionFileInput[] = [];
    for (const raw of body.files) {
      if (!raw.role || !ROLE_SET.has(raw.role)) {
        return jsonWithClientIdCookie(
          { error: "알 수 없는 파일 역할입니다.", code: "DOCLING_INVALID_ROLE" },
          clientId,
          { status: 400 },
        );
      }
      if (!raw.fileName || typeof raw.declaredFileSize !== "number") {
        return jsonWithClientIdCookie(
          {
            error: "fileName과 declaredFileSize가 필요합니다.",
            code: "DOCLING_FILE_REQUIRED",
          },
          clientId,
          { status: 400 },
        );
      }
      files.push({
        role: raw.role as KnowledgePackFileRole,
        fileName: raw.fileName,
        mimeType: raw.mimeType ?? null,
        declaredFileSize: raw.declaredFileSize,
        lastModifiedMs:
          typeof raw.lastModifiedMs === "number" && Number.isFinite(raw.lastModifiedMs)
            ? raw.lastModifiedMs
            : null,
        headSha256: typeof raw.headSha256 === "string" ? raw.headSha256 : null,
        tailSha256: typeof raw.tailSha256 === "string" ? raw.tailSha256 : null,
      });
    }

    const result = await createDoclingUploadSession({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      files,
    });

    return jsonWithClientIdCookie({ clientId, session: result.session }, clientId, {
      status: 201,
    });
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
      path: "/api/v1/provider/packs/[packId]/docling-import/upload-sessions",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
