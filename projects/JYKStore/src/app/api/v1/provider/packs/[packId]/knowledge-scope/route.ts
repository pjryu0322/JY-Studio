/**
 * GET  /api/v1/provider/packs/[packId]/knowledge-scope — requested inventory items
 * POST /api/v1/provider/packs/[packId]/knowledge-scope — respond INCLUDE/EXCLUDE
 */
import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { getProviderPackForClient } from "@/lib/provider-pack-service";
import { listProviderRequestedInventoryItems } from "@/lib/knowledge-scope/inventory-query-service";
import { respondProviderInventoryDecision } from "@/lib/knowledge-scope/inventory-provider-decision-service";
import { mapKnowledgeScopeInventoryError } from "@/lib/knowledge-scope/inventory-route-helpers";
import type { ProviderInventoryDecision } from "@/lib/knowledge-scope/inventory-types";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;
  const packIdTrim = packId?.trim() ?? "";

  try {
    const pack = await getProviderPackForClient(userId, clientId, packIdTrim);
    if (!pack) {
      return jsonWithClientIdCookie(
        { error: { code: "PACK_NOT_FOUND", message: "지식팩을 찾을 수 없습니다." } },
        clientId,
        { status: 404 },
      );
    }

    const items = await listProviderRequestedInventoryItems(packIdTrim);
    return jsonWithClientIdCookie({ clientId, items }, clientId, { status: 200 });
  } catch (error) {
    return mapKnowledgeScopeInventoryError(
      error,
      clientId,
      "provider/knowledge-scope",
      "GET",
      `/api/v1/provider/packs/${packId}/knowledge-scope`,
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;
  const packIdTrim = packId?.trim() ?? "";

  try {
    const pack = await getProviderPackForClient(userId, clientId, packIdTrim);
    if (!pack) {
      return jsonWithClientIdCookie(
        { error: { code: "PACK_NOT_FOUND", message: "지식팩을 찾을 수 없습니다." } },
        clientId,
        { status: 404 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      itemIds?: unknown;
      decision?: string;
    } | null;

    const decision = body?.decision as ProviderInventoryDecision | undefined;
    const itemIds = Array.isArray(body?.itemIds)
      ? body!.itemIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    if (decision !== "INCLUDED" && decision !== "EXCLUDED") {
      return jsonWithClientIdCookie(
        { error: { code: "DECISION_REQUIRED", message: "INCLUDED 또는 EXCLUDED가 필요합니다." } },
        clientId,
        { status: 400 },
      );
    }

    const items = await respondProviderInventoryDecision({
      packId: packIdTrim,
      itemIds,
      decision,
      providerUserId: userId,
    });

    return jsonWithClientIdCookie({ clientId, items }, clientId, { status: 200 });
  } catch (error) {
    return mapKnowledgeScopeInventoryError(
      error,
      clientId,
      "provider/knowledge-scope",
      "POST",
      `/api/v1/provider/packs/${packId}/knowledge-scope`,
    );
  }
}
