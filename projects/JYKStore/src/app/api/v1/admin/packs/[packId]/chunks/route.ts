import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { listPackChunks } from "@/lib/chunk-pipeline-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { legacyBuilderDisabledBody } from "@/lib/legacy-builder-disabled";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;

  try {
    const data = await listPackChunks(packId?.trim() ?? "");
    if (!data) {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, {
        status: 404,
      });
    }
    return jsonWithClientIdCookie({ clientId, ...data }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "admin-pack-chunks",
      method: "GET",
      path: "/api/v1/admin/packs/[packId]/chunks",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  void context;
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;
  return jsonWithClientIdCookie(legacyBuilderDisabledBody(), clientId, { status: 410 });
}
