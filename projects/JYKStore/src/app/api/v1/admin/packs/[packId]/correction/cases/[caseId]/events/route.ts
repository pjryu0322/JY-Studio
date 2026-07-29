/**
 * GET /api/v1/admin/packs/[packId]/correction/cases/[caseId]/events
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { listCorrectionCaseEvents } from "@/lib/correction/correction-query-service";
import { mapCorrectionRouteError } from "@/lib/correction/correction-route-helpers";

type RouteContext = { params: Promise<{ packId: string; caseId: string }> };

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

  const { packId, caseId } = await context.params;
  try {
    const events = await listCorrectionCaseEvents({
      packId: packId?.trim() ?? "",
      caseId: caseId?.trim() ?? "",
    });
    return jsonWithClientIdCookie({ clientId, events }, clientId, { status: 200 });
  } catch (error) {
    return mapCorrectionRouteError(
      error,
      clientId,
      "admin/correction/events",
      "GET",
      `/api/v1/admin/packs/${packId}/correction/cases/${caseId}/events`,
    );
  }
}
