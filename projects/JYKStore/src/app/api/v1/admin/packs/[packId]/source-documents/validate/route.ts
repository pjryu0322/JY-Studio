import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId, getClientIdFromRequest, jsonWithClientIdCookie } from "@/lib/client-identity";
import { validateAdminPackSourceDocuments } from "@/lib/admin-review-service";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

async function parseJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as { sourceDocumentId?: string };
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;

  try {
    const body = await parseJsonBody(request);
    const result = await validateAdminPackSourceDocuments({
      packId: packId?.trim() ?? "",
      sourceDocumentId: body.sourceDocumentId?.trim(),
      reviewerClientId: getClientIdFromRequest(request) ?? clientId,
    });

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie(
        { error: result.message ?? "지식팩을 찾을 수 없습니다." },
        clientId,
        { status: 404 },
      );
    }

    return jsonWithClientIdCookie({ clientId, detail: result.detail }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "admin-pack-source-validation", method: "POST", path: "/api/v1/admin/packs/[packId]/source-documents/validate", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
