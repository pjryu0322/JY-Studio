/**
 * P7.3: Admin 접수함 — list DRAFT packs with a pending ZIP generation request.
 *
 * Providers submit requests that keep the pack DRAFT (so they never appear in the
 * REVIEWING review list). This queue surfaces them to Admins, who open the pack and
 * execute generation via /api/v1/admin/packs/[packId]/worker-zip. Gated by
 * requireAdminSession.
 *
 * Also returns provider 보완요청 / WITHDRAWN packs (ZIP markers cleared on withdraw).
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  batchAttachInboxWorkflow,
  withInboxWorkflow,
} from "@/lib/admin-work-inbox/admin-work-inbox-workflow";
import { listAdminProviderReturnedPacks } from "@/lib/store-workflow-markers";
import { listAdminWorkerZipRequests } from "@/lib/python-worker/worker-zip-import-provider-service";
import { logSafeRouteError } from "@/lib/safe-logging";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminAuth = await requireAdminSession(request, clientId);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }

  try {
    const [items, returnedItems] = await Promise.all([
      listAdminWorkerZipRequests(),
      listAdminProviderReturnedPacks(),
    ]);
    const packIds = [
      ...items.map((item) => item.packId),
      ...returnedItems.map((item) => item.packId),
    ];
    const workflowByPack = await batchAttachInboxWorkflow(packIds);
    return jsonWithClientIdCookie(
      {
        clientId,
        items: withInboxWorkflow(items, workflowByPack),
        returnedItems: withInboxWorkflow(returnedItems, workflowByPack),
      },
      clientId,
      { status: 200 },
    );
  } catch (error) {
    logSafeRouteError({
      scope: "admin/worker-zip-requests",
      method: "GET",
      path: "/api/v1/admin/worker-zip-requests",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}
