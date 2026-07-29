/**
 * POST /api/v1/admin/packs/[packId]/correction/regenerate
 * Regeneration → Auto Quality → Outcome (status → REGENERATED).
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { regenerateAfterCorrection } from "@/lib/correction/correction-regenerate-service";
import { mapCorrectionRouteError } from "@/lib/correction/correction-route-helpers";

type RouteContext = { params: Promise<{ packId: string }> };

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

  const { packId } = await context.params;
  try {
    const body = (await request.json().catch(() => null)) as {
      caseIds?: string[];
      skipFullGeneration?: boolean;
    } | null;

    const result = await regenerateAfterCorrection({
      packId: packId?.trim() ?? "",
      actorUserId: adminAuth.adminUserId,
      clientId,
      caseIds: body?.caseIds,
      skipFullGeneration: body?.skipFullGeneration,
    });

    return jsonWithClientIdCookie({ clientId, ...result }, clientId, { status: 200 });
  } catch (error) {
    return mapCorrectionRouteError(
      error,
      clientId,
      "admin/correction/regenerate",
      "POST",
      `/api/v1/admin/packs/${packId}/correction/regenerate`,
    );
  }
}
