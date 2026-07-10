import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { evaluateAdminPackReleaseGate } from "@/lib/admin-review-service";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";

type RouteContext = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;

  let targetStatus: "PUBLISHED" | "VERIFIED" | undefined;
  try {
    const body = (await request.json()) as { targetStatus?: string };
    if (body.targetStatus === "VERIFIED" || body.targetStatus === "PUBLISHED") {
      targetStatus = body.targetStatus;
    }
  } catch {
    // empty body is allowed
  }

  try {
    const result = await evaluateAdminPackReleaseGate({
      packId: packId?.trim() ?? "",
      reviewerClientId: clientId,
      targetStatus,
    });

    if ("error" in result) {
      if (result.error === "NOT_FOUND") {
        return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, {
          status: 404,
        });
      }
    }

    return jsonWithClientIdCookie({ clientId, detail: result.detail }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "admin-pack-release-gate", method: "POST", path: "/api/v1/admin/packs/[packId]/release-gate/evaluate", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
