/**
 * GET /api/v1/provider/packs/[packId]/knowledge-scope/items/[itemId]/preview
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { getProviderPackForClient } from "@/lib/provider-pack-service";
import { getInventoryItemPreview } from "@/lib/knowledge-scope/inventory-preview-service";
import { mapKnowledgeScopeInventoryError } from "@/lib/knowledge-scope/inventory-route-helpers";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ packId: string; itemId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, itemId } = await context.params;
  const packIdTrim = packId?.trim() ?? "";
  const itemIdTrim = itemId?.trim() ?? "";

  try {
    const pack = await getProviderPackForClient(userId, clientId, packIdTrim);
    if (!pack) {
      return jsonWithClientIdCookie(
        { error: { code: "PACK_NOT_FOUND", message: "지식팩을 찾을 수 없습니다." } },
        clientId,
        { status: 404 },
      );
    }

    const item = await prisma.knowledgeScopeInventoryItem.findUnique({
      where: { id: itemIdTrim },
      select: {
        providerDecisionStatus: true,
        inventory: { select: { packId: true } },
      },
    });
    if (!item || item.inventory.packId !== packIdTrim) {
      return jsonWithClientIdCookie(
        { error: { code: "ITEM_NOT_FOUND", message: "항목을 찾을 수 없습니다." } },
        clientId,
        { status: 404 },
      );
    }
    if (item.providerDecisionStatus !== "REQUESTED") {
      return jsonWithClientIdCookie(
        {
          error: {
            code: "PROVIDER_DECISION_NOT_REQUESTED",
            message: "제공자 확인이 요청된 항목만 미리볼 수 있습니다.",
          },
        },
        clientId,
        { status: 403 },
      );
    }

    const preview = await getInventoryItemPreview({
      packId: packIdTrim,
      itemId: itemIdTrim,
    });

    if (preview.kind === "text" || preview.kind === "unsupported") {
      return jsonWithClientIdCookie({ clientId, preview }, clientId, { status: 200 });
    }

    const headers = new Headers({
      "Content-Type": preview.mimeType,
      "Content-Length": String(preview.bytes.byteLength),
      "Cache-Control": "private, no-store",
      "X-Preview-Kind": preview.kind,
      "X-Preview-Path": encodeURIComponent(preview.relativePath),
    });
    return new NextResponse(Buffer.from(preview.bytes), { status: 200, headers });
  } catch (error) {
    return mapKnowledgeScopeInventoryError(
      error,
      clientId,
      "provider/knowledge-scope/preview",
      "GET",
      `/api/v1/provider/packs/${packId}/knowledge-scope/items/${itemId}/preview`,
    );
  }
}
