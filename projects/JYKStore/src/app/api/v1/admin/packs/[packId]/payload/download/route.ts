import { NextRequest, NextResponse } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { buildContentDisposition } from "@/lib/distribution/content-disposition";
import { isPayloadServiceError } from "@/lib/distribution/payload-errors";
import { readAdminPayloadBytes } from "@/lib/distribution/payload-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
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
  const { packId } = await context.params;

  try {
    const result = await readAdminPayloadBytes({
      packId: packId?.trim() ?? "",
      actorUserId: adminAuth.adminUserId,
    });

    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": buildContentDisposition(result.originalFileName),
        "X-JYKStore-SHA256": result.checksumSha256,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (isPayloadServiceError(error)) {
      return jsonWithClientIdCookie(
        { error: error.message, code: error.code },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "admin-route",
      method: "GET",
      path: "/api/v1/admin/packs/[packId]/payload/download",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
