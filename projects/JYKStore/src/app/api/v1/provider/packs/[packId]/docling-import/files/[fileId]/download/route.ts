import { NextRequest, NextResponse } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { buildContentDisposition } from "@/lib/distribution/content-disposition";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { downloadDoclingImportFile } from "@/lib/docling-import/docling-import-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";

type RouteContext = {
  params: Promise<{ packId: string; fileId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, fileId } = await context.params;

  try {
    const result = await downloadDoclingImportFile({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      fileId: fileId?.trim() ?? "",
    });

    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": buildContentDisposition(result.fileName),
        "X-JYKStore-SHA256": result.checksumSha256,
        "Cache-Control": "no-store",
      },
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
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/docling-import/files/[fileId]/download",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
