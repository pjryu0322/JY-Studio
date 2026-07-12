import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { legacyBuilderDisabledBody } from "@/lib/legacy-builder-disabled";
import { requireAdminSession } from "@/lib/admin-route-guard";

type RouteContext = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  void context;
  const clientId = ensureClientId(request);
  const adminAuth = await requireAdminSession(request, clientId);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }
  return jsonWithClientIdCookie(legacyBuilderDisabledBody(), clientId, { status: 410 });
}
