import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { legacyBuilderDisabledBody } from "@/lib/legacy-builder-disabled";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";

type RouteContext = { params: Promise<{ packId: string; chunkId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  void context;
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;
  return jsonWithClientIdCookie(legacyBuilderDisabledBody(), clientId, { status: 410 });
}
