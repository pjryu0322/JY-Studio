import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { streamDoclingFigurePreview } from "@/lib/docling-import/docling-import-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";

type RouteContext = {
  params: Promise<{ packId: string; bundleId: string; figureId: string }>;
};

function toWebReadable(stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream) {
  if (typeof (stream as ReadableStream).getReader === "function") {
    return stream as ReadableStream<Uint8Array>;
  }
  return Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, bundleId, figureId } = await context.params;

  try {
    const result = await streamDoclingFigurePreview({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      bundleId: bundleId?.trim() ?? "",
      figureId: figureId?.trim() ?? "",
    });

    return new NextResponse(toWebReadable(result.stream), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        ...(result.contentLength != null
          ? { "Content-Length": String(result.contentLength) }
          : {}),
        "Cache-Control": "private, max-age=300",
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
      path: "/api/v1/provider/packs/[packId]/docling-import/[bundleId]/figures/[figureId]/preview",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
