import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import {
  abortDoclingUploadSession,
  getDoclingUploadSession,
} from "@/lib/docling-import/docling-upload-session-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ packId: string; sessionId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, sessionId } = await context.params;

  try {
    const result = await getDoclingUploadSession({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      sessionId: sessionId?.trim() ?? "",
    });
    return jsonWithClientIdCookie({ clientId, session: result.session }, clientId);
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
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/docling-import/upload-sessions/[sessionId]",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, sessionId } = await context.params;

  try {
    const result = await abortDoclingUploadSession({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      sessionId: sessionId?.trim() ?? "",
    });
    return jsonWithClientIdCookie({ clientId, session: result.session }, clientId);
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
      method: "DELETE",
      path: "/api/v1/provider/packs/[packId]/docling-import/upload-sessions/[sessionId]",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
