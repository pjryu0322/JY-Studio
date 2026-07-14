import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  DoclingImportError,
  isDoclingImportError,
} from "@/lib/docling-import/docling-import-errors";
import { confirmProviderDoclingImport } from "@/lib/docling-import/docling-import-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";

type RouteContext = {
  params: Promise<{ packId: string; bundleId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, bundleId } = await context.params;

  try {
    const result = await confirmProviderDoclingImport({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      bundleId: bundleId?.trim() ?? "",
    });
    return jsonWithClientIdCookie({ clientId, bundle: result.bundle }, clientId);
  } catch (error) {
    if (isDoclingImportError(error)) {
      const blockers = (error as DoclingImportError & { blockers?: unknown }).blockers;
      return jsonWithClientIdCookie(
        {
          error: error.message,
          code: error.code,
          ...(blockers ? { blockers } : {}),
        },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider-route",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/docling-import/[bundleId]/confirm",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
