import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import {
  deleteActiveDoclingImport,
  getActiveDoclingImport,
} from "@/lib/docling-import/docling-import-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const result = await getActiveDoclingImport({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
    });
    return jsonWithClientIdCookie(
      { clientId, bundle: result.bundle, stagingBundle: result.stagingBundle },
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
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/docling-import",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

/**
 * FormData multipart POST is deprecated. Clients must use upload-sessions.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId } = auth;
  await context.params;
  void request;

  return jsonWithClientIdCookie(
    {
      error:
        "FormData Docling 업로드는 더 이상 지원되지 않습니다. /docling-import/upload-sessions 를 사용하세요.",
      code: "DOCLING_FORMDATA_UPLOAD_GONE",
    },
    clientId,
    { status: 410 },
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    await deleteActiveDoclingImport({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
    });
    return jsonWithClientIdCookie({ clientId, deleted: true }, clientId);
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
      path: "/api/v1/provider/packs/[packId]/docling-import",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
