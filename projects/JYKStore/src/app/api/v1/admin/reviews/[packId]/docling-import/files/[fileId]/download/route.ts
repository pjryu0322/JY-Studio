import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { buildContentDisposition } from "@/lib/distribution/content-disposition";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { downloadDoclingImportFile } from "@/lib/docling-import/docling-import-service";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ packId: string; fileId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminAuth = await requireAdminSession(request, clientId);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }
  const { packId, fileId } = await context.params;

  try {
    const preview =
      request.nextUrl.searchParams.get("preview") === "1" ||
      request.nextUrl.searchParams.get("preview") === "true";
    const maxBytesRaw = request.nextUrl.searchParams.get("maxBytes");
    const maxBytesParsed = maxBytesRaw ? Number.parseInt(maxBytesRaw, 10) : NaN;
    const result = await downloadDoclingImportFile({
      asAdmin: true,
      packId: packId?.trim() ?? "",
      fileId: fileId?.trim() ?? "",
      previewMaxBytes: preview
        ? Number.isFinite(maxBytesParsed) && maxBytesParsed > 0
          ? maxBytesParsed
          : 100 * 1024
        : undefined,
    });

    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": buildContentDisposition(result.fileName),
        "X-JYKStore-SHA256": result.checksumSha256,
        "Cache-Control": "no-store",
        ...(result.truncated ? { "X-JYKStore-Preview-Truncated": "1" } : {}),
        ...(result.contentLength != null
          ? { "X-JYKStore-Content-Length": String(result.contentLength) }
          : {}),
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
      scope: "admin-route",
      method: "GET",
      path: "/api/v1/admin/reviews/[packId]/docling-import/files/[fileId]/download",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
