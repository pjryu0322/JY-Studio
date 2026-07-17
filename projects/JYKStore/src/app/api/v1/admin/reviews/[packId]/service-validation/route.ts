import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import { getAdminServiceValidationForPack } from "@/lib/distribution/service-validation-service";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { prisma } from "@/lib/prisma";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;
  try {
    const pack = await prisma.knowledgePack.findUnique({
      where: { packId: packId?.trim() ?? "" },
      include: { versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 } },
    });
    if (!pack || !pack.versions[0]) {
      return jsonWithClientIdCookie(
        { error: "NOT_FOUND", message: "지식팩을 찾을 수 없습니다." },
        clientId,
        { status: 404 },
      );
    }
    const runs = await getAdminServiceValidationForPack({
      packId: pack.packId,
      versionId: pack.versions[0].id,
    });
    return jsonWithClientIdCookie(
      { clientId, packId: pack.packId, versionId: pack.versions[0].id, runs },
      clientId,
    );
  } catch (error) {
    logSafeRouteError({
      scope: "admin/reviews/service-validation",
      method: "GET",
      path: "/api/v1/admin/reviews/[packId]/service-validation",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
