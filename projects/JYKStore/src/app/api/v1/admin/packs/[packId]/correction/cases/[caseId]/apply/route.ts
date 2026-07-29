/**
 * POST /api/v1/admin/packs/[packId]/correction/cases/[caseId]/apply
 */
import type { CorrectionRequestedAction } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { applyCorrectionCase } from "@/lib/correction/correction-apply-service";
import { mapCorrectionRouteError } from "@/lib/correction/correction-route-helpers";

type RouteContext = { params: Promise<{ packId: string; caseId: string }> };

const ACTIONS = new Set<CorrectionRequestedAction>([
  "FILE_EXCLUDE",
  "FILE_REQUEST_PROVIDER",
  "STRUCTURE_DELETE",
  "STRUCTURE_MERGE",
  "CHUNK_DELETE",
  "CHUNK_MERGE",
]);

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
    const body = (await request.json().catch(() => null)) as {
      action?: string;
      secondaryTargetId?: string;
      reasonText?: string;
      providerRequestNote?: string;
    } | null;

    const action = body?.action as CorrectionRequestedAction | undefined;
    if (!action || !ACTIONS.has(action)) {
      return jsonWithClientIdCookie(
        { error: { code: "ACTION_REQUIRED", message: "유효한 action이 필요합니다." } },
        clientId,
        { status: 400 },
      );
    }

    const correctionCase = await applyCorrectionCase({
      packId: packId?.trim() ?? "",
      caseId: caseId?.trim() ?? "",
      action,
      actorUserId: adminAuth.adminUserId,
      secondaryTargetId: body?.secondaryTargetId,
      reasonText: body?.reasonText,
      providerRequestNote: body?.providerRequestNote,
    });

    return jsonWithClientIdCookie({ clientId, case: correctionCase }, clientId, {
      status: 200,
    });
  } catch (error) {
    return mapCorrectionRouteError(
      error,
      clientId,
      "admin/correction/apply",
      "POST",
      `/api/v1/admin/packs/${packId}/correction/cases/${caseId}/apply`,
    );
  }
}
