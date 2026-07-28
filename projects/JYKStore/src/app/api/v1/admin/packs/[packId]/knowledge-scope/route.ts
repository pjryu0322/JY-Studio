/**
 * GET  /api/v1/admin/packs/[packId]/knowledge-scope — inventory summary
 * POST /api/v1/admin/packs/[packId]/knowledge-scope — ensure/create from ZIP
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { ensureInventoryAfterAccept } from "@/lib/knowledge-scope/inventory-create-service";
import { getKnowledgeScopeInventorySummary } from "@/lib/knowledge-scope/inventory-query-service";
import { mapKnowledgeScopeInventoryError } from "@/lib/knowledge-scope/inventory-route-helpers";
import {
  canFinalizeKnowledgeScope,
  isKnowledgeScopeReadyForGeneration,
} from "@/lib/knowledge-scope/inventory-gate";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { prisma } from "@/lib/prisma";

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
    const summary = await getKnowledgeScopeInventorySummary(packId?.trim() ?? "");
    return jsonWithClientIdCookie(
      {
        clientId,
        inventory: summary,
        canFinalize: canFinalizeKnowledgeScope(summary),
        readyForGeneration: isKnowledgeScopeReadyForGeneration(summary),
      },
      clientId,
      { status: 200 },
    );
  } catch (error) {
    return mapKnowledgeScopeInventoryError(
      error,
      clientId,
      "admin/knowledge-scope",
      "GET",
      `/api/v1/admin/packs/${packId}/knowledge-scope`,
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
  const packIdTrim = packId?.trim() ?? "";
  try {
    const pack = await prisma.knowledgePack.findFirst({
      where: { packId: packIdTrim },
      select: {
        packId: true,
        versions: {
          orderBy: latestKnowledgePackVersionOrderBy,
          take: 1,
          select: { id: true },
        },
      },
    });
    const versionId = pack?.versions[0]?.id;
    if (!pack || !versionId) {
      return jsonWithClientIdCookie(
        { error: { code: "PACK_NOT_FOUND", message: "지식팩을 찾을 수 없습니다." } },
        clientId,
        { status: 404 },
      );
    }

    const summary = await ensureInventoryAfterAccept({
      packId: pack.packId,
      versionId,
      clientId,
      adminUserId: adminAuth.adminUserId,
    });

    return jsonWithClientIdCookie(
      {
        clientId,
        inventory: summary,
        canFinalize: canFinalizeKnowledgeScope(summary),
        readyForGeneration: isKnowledgeScopeReadyForGeneration(summary),
      },
      clientId,
      { status: 200 },
    );
  } catch (error) {
    return mapKnowledgeScopeInventoryError(
      error,
      clientId,
      "admin/knowledge-scope",
      "POST",
      `/api/v1/admin/packs/${packId}/knowledge-scope`,
    );
  }
}
