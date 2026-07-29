/**
 * GET /api/v1/admin/packs/[packId]/correction — workbench summary + cases
 * POST /api/v1/admin/packs/[packId]/correction — sync cases from quality
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { mapCorrectionRouteError } from "@/lib/correction/correction-route-helpers";
import { getCorrectionWorkbench } from "@/lib/correction/correction-query-service";
import { syncCorrectionCasesFromQuality } from "@/lib/correction/correction-sync-service";

type RouteContext = { params: Promise<{ packId: string }> };

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
    const includeClosed =
      new URL(request.url).searchParams.get("includeClosed") === "1";
    const workbench = await getCorrectionWorkbench({
      packId: packId?.trim() ?? "",
      includeClosed,
    });
    return jsonWithClientIdCookie({ clientId, ...workbench }, clientId, { status: 200 });
  } catch (error) {
    return mapCorrectionRouteError(
      error,
      clientId,
      "admin/correction",
      "GET",
      `/api/v1/admin/packs/${packId}/correction`,
    );
  }
}

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
    const body = (await request.json().catch(() => null)) as { action?: string } | null;
    if (body?.action && body.action !== "sync") {
      return jsonWithClientIdCookie(
        { error: { code: "INVALID_ACTION", message: "지원하는 action은 sync 입니다." } },
        clientId,
        { status: 400 },
      );
    }
    const result = await syncCorrectionCasesFromQuality({
      packId: packId?.trim() ?? "",
      actorUserId: adminAuth.adminUserId,
    });
    const workbench = await getCorrectionWorkbench({ packId: packId?.trim() ?? "" });
    return jsonWithClientIdCookie(
      { clientId, created: result.created, ...workbench },
      clientId,
      { status: 200 },
    );
  } catch (error) {
    return mapCorrectionRouteError(
      error,
      clientId,
      "admin/correction",
      "POST",
      `/api/v1/admin/packs/${packId}/correction`,
    );
  }
}
