/**
 * POST /api/v1/admin/packs/[packId]/knowledge-scope/bulk — bulk decisions
 */
import type { KnowledgeScopeExclusionReason } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { bulkUpdateInventoryItemDecisions } from "@/lib/knowledge-scope/inventory-decision-service";
import { getKnowledgeScopeInventorySummary } from "@/lib/knowledge-scope/inventory-query-service";
import { mapKnowledgeScopeInventoryError } from "@/lib/knowledge-scope/inventory-route-helpers";
import type { InventoryAdminDecisionAction } from "@/lib/knowledge-scope/inventory-types";

type RouteContext = { params: Promise<{ packId: string }> };

const ACTIONS = new Set<InventoryAdminDecisionAction>([
  "INCLUDE",
  "EXCLUDE",
  "REQUEST_PROVIDER",
  "CLEAR_TO_REVIEW",
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

  const { packId } = await context.params;
  try {
    const summary = await getKnowledgeScopeInventorySummary(packId?.trim() ?? "");
    if (!summary) {
      return jsonWithClientIdCookie(
        { error: { code: "INVENTORY_NOT_FOUND", message: "인벤토리가 아직 없습니다." } },
        clientId,
        { status: 404 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      itemIds?: unknown;
      action?: string;
      exclusionReasonCode?: KnowledgeScopeExclusionReason;
      exclusionReasonText?: string;
      providerRequestNote?: string;
    } | null;

    const action = body?.action as InventoryAdminDecisionAction | undefined;
    const itemIds = Array.isArray(body?.itemIds)
      ? body!.itemIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    if (!action || !ACTIONS.has(action)) {
      return jsonWithClientIdCookie(
        { error: { code: "ACTION_REQUIRED", message: "유효한 action이 필요합니다." } },
        clientId,
        { status: 400 },
      );
    }
    if (itemIds.length === 0) {
      return jsonWithClientIdCookie(
        { error: { code: "ITEM_IDS_REQUIRED", message: "대상 항목을 선택하세요." } },
        clientId,
        { status: 400 },
      );
    }

    const items = await bulkUpdateInventoryItemDecisions({
      inventoryId: summary.id,
      itemIds,
      action,
      actorUserId: adminAuth.adminUserId,
      exclusionReasonCode: body?.exclusionReasonCode,
      exclusionReasonText: body?.exclusionReasonText,
      providerRequestNote: body?.providerRequestNote,
    });

    return jsonWithClientIdCookie({ clientId, items }, clientId, { status: 200 });
  } catch (error) {
    return mapKnowledgeScopeInventoryError(
      error,
      clientId,
      "admin/knowledge-scope/bulk",
      "POST",
      `/api/v1/admin/packs/${packId}/knowledge-scope/bulk`,
    );
  }
}
