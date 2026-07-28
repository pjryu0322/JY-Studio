/**
 * GET /api/v1/admin/packs/[packId]/knowledge-scope/items/[itemId]/preview
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { getInventoryItemPreview } from "@/lib/knowledge-scope/inventory-preview-service";
import { mapKnowledgeScopeInventoryError } from "@/lib/knowledge-scope/inventory-route-helpers";

type RouteContext = { params: Promise<{ packId: string; itemId: string }> };

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

  const { packId, itemId } = await context.params;
  try {
    const preview = await getInventoryItemPreview({
      packId: packId?.trim() ?? "",
      itemId: itemId?.trim() ?? "",
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
    // Attach client cookie via empty JSON helper is awkward for binary — set manually.
    const response = new NextResponse(Buffer.from(preview.bytes), { status: 200, headers });
    return response;
  } catch (error) {
    return mapKnowledgeScopeInventoryError(
      error,
      clientId,
      "admin/knowledge-scope/preview",
      "GET",
      `/api/v1/admin/packs/${packId}/knowledge-scope/items/${itemId}/preview`,
    );
  }
}
