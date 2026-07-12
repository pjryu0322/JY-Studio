import { NextRequest, NextResponse } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { buildContentDisposition } from "@/lib/distribution/content-disposition";
import { isPayloadServiceError } from "@/lib/distribution/payload-errors";
import { readPublicCatalogPayloadBytes } from "@/lib/distribution/payload-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { packId } = await context.params;

  try {
    const result = await readPublicCatalogPayloadBytes({
      packId: packId?.trim() ?? "",
    });

    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": buildContentDisposition(result.originalFileName),
        "X-JYKStore-SHA256": result.checksumSha256,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    if (isPayloadServiceError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "public-route",
      method: "GET",
      path: "/api/v1/packs/[packId]/payload/download",
      error,
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}
