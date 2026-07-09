import { NextRequest } from "next/server";
import { rebuildPackEmbeddings } from "@/lib/chunk-embedding-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";

type RouteContext = { params: Promise<{ packId: string }> };

async function parseJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as { force?: unknown };
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;

  try {
    const body = await parseJsonBody(request);
    const force = body?.force === true;

    const result = await rebuildPackEmbeddings({ packId: packId?.trim() ?? "", force });
    if (!result) {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    return jsonWithClientIdCookie({ clientId, ...result }, clientId);
  } catch (error) {
    console.error("POST pack embeddings rebuild failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
