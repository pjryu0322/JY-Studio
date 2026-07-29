/**
 * POST /api/v1/admin/packs/[packId]/correction/cases/[caseId]/close
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { closeCorrectionCase } from "@/lib/correction/correction-lifecycle-service";
import { mapCorrectionRouteError } from "@/lib/correction/correction-route-helpers";

type RouteContext = { params: Promise<{ packId: string; caseId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminAuth = await requireAdminSession(request, clientId);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }

  const { packId, caseId } = await context.params;
  try {
    const correctionCase = await closeCorrectionCase({
      packId: packId?.trim() ?? "",
      caseId: caseId?.trim() ?? "",
      actorUserId: adminAuth.adminUserId,
    });
    return jsonWithClientIdCookie({ clientId, case: correctionCase }, clientId, {
      status: 200,
    });
  } catch (error) {
    return mapCorrectionRouteError(
      error,
      clientId,
      "admin/correction/close",
      "POST",
      `/api/v1/admin/packs/${packId}/correction/cases/${caseId}/close`,
    );
  }
}
