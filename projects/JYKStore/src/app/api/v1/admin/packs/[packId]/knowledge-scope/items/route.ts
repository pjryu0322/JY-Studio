/**
 * GET /api/v1/admin/packs/[packId]/knowledge-scope/items — paged inventory items
 */
import type {
  KnowledgeScopeDecisionSource,
  KnowledgeScopeExclusionReason,
  KnowledgeScopeItemDecision,
  KnowledgeScopeProviderDecision,
} from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  getKnowledgeScopeInventorySummary,
  listKnowledgeScopeInventoryItems,
} from "@/lib/knowledge-scope/inventory-query-service";
import { mapKnowledgeScopeInventoryError } from "@/lib/knowledge-scope/inventory-route-helpers";

type RouteContext = { params: Promise<{ packId: string }> };

function asEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

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
    const summary = await getKnowledgeScopeInventorySummary(packId?.trim() ?? "");
    if (!summary) {
      return jsonWithClientIdCookie(
        { error: { code: "INVENTORY_NOT_FOUND", message: "인벤토리가 아직 없습니다." } },
        clientId,
        { status: 404 },
      );
    }

    const sp = request.nextUrl.searchParams;
    const page = Number(sp.get("page") ?? "1");
    const pageSize = Number(sp.get("pageSize") ?? "50");
    const result = await listKnowledgeScopeInventoryItems({
      inventoryId: summary.id,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 50,
      q: sp.get("q") ?? undefined,
      decision: asEnum(sp.get("decision"), [
        "PENDING",
        "INCLUDED",
        "EXCLUDED",
        "REVIEW_REQUIRED",
      ] as const satisfies readonly KnowledgeScopeItemDecision[]),
      extension: sp.get("extension") ?? undefined,
      exclusionReasonCode: asEnum(sp.get("exclusionReasonCode"), [
        "ZERO_BYTE",
        "EXECUTABLE",
        "EXECUTABLE_LIBRARY",
        "BUILD_ARTIFACT",
        "CACHE",
        "FONT",
        "LICENSE_OR_KEY",
        "UNSUPPORTED",
        "NON_KNOWLEDGE_FILE",
        "ADMIN_DECISION",
        "PROVIDER_DECISION",
        "EXCLUDED_DIRECTORY",
        "EXCLUDED_FILE_NAME",
        "EXCLUDED_EXTENSION",
        "FILE_SIZE_EXCEEDED",
        "OTHER",
      ] as const satisfies readonly KnowledgeScopeExclusionReason[]),
      decisionSource: asEnum(sp.get("decisionSource"), [
        "SYSTEM",
        "ADMIN",
        "PROVIDER",
      ] as const satisfies readonly KnowledgeScopeDecisionSource[]),
      providerDecisionStatus: asEnum(sp.get("providerDecisionStatus"), [
        "NONE",
        "REQUESTED",
        "INCLUDED",
        "EXCLUDED",
      ] as const satisfies readonly KnowledgeScopeProviderDecision[]),
      pathPrefix: sp.get("pathPrefix") ?? undefined,
    });

    return jsonWithClientIdCookie({ clientId, inventoryId: summary.id, ...result }, clientId, {
      status: 200,
    });
  } catch (error) {
    return mapKnowledgeScopeInventoryError(
      error,
      clientId,
      "admin/knowledge-scope/items",
      "GET",
      `/api/v1/admin/packs/${packId}/knowledge-scope/items`,
    );
  }
}
