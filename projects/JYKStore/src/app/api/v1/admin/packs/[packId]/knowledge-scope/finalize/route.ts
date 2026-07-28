/**
 * POST /api/v1/admin/packs/[packId]/knowledge-scope/finalize — scope finalize
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { finalizeKnowledgeScopeInventory } from "@/lib/knowledge-scope/inventory-decision-service";
import { getKnowledgeScopeInventorySummary } from "@/lib/knowledge-scope/inventory-query-service";
import { isKnowledgeScopeReadyForGeneration } from "@/lib/knowledge-scope/inventory-gate";
import { mapKnowledgeScopeInventoryError } from "@/lib/knowledge-scope/inventory-route-helpers";

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
    const summary = await getKnowledgeScopeInventorySummary(packId?.trim() ?? "");
    if (!summary) {
      return jsonWithClientIdCookie(
        { error: { code: "INVENTORY_NOT_FOUND", message: "인벤토리가 아직 없습니다." } },
        clientId,
        { status: 404 },
      );
    }

    const inventory = await finalizeKnowledgeScopeInventory({
      inventoryId: summary.id,
      actorUserId: adminAuth.adminUserId,
    });

    return jsonWithClientIdCookie(
      {
        clientId,
        inventory,
        readyForGeneration: isKnowledgeScopeReadyForGeneration(inventory),
      },
      clientId,
      { status: 200 },
    );
  } catch (error) {
    return mapKnowledgeScopeInventoryError(
      error,
      clientId,
      "admin/knowledge-scope/finalize",
      "POST",
      `/api/v1/admin/packs/${packId}/knowledge-scope/finalize`,
    );
  }
}
