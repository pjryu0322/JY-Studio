import { KnowledgePackFileRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { completeDoclingUploadSession } from "@/lib/docling-import/docling-upload-session-service";
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
    let partsByRole:
      | Partial<Record<KnowledgePackFileRole, Array<{ partNumber: number; etag: string }>>>
      | undefined;

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as {
        partsByRole?: Record<string, Array<{ partNumber?: number; etag?: string }>>;
      } | null;
      if (body?.partsByRole && typeof body.partsByRole === "object") {
        partsByRole = {};
        for (const [role, parts] of Object.entries(body.partsByRole)) {
          if (!ROLE_SET.has(role) || !Array.isArray(parts)) continue;
          partsByRole[role as KnowledgePackFileRole] = parts
            .filter(
              (p): p is { partNumber: number; etag: string } =>
                typeof p?.partNumber === "number" && typeof p?.etag === "string",
            )
            .map((p) => ({ partNumber: p.partNumber, etag: p.etag }));
        }
      }
    }

    const result = await completeDoclingUploadSession({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      sessionId: sessionId?.trim() ?? "",
      partsByRole,
    });

    // 202 Accepted — validation/normalization runs on the Docling processing worker.
    return jsonWithClientIdCookie(
      {
        clientId,
        accepted: true,
        session: result.session,
        bundleId: result.bundleId,
        processingJobId: result.processingJobId,
      },
      clientId,
      { status: 202 },
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
      path: "/api/v1/provider/packs/[packId]/docling-import/upload-sessions/[sessionId]/complete",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
