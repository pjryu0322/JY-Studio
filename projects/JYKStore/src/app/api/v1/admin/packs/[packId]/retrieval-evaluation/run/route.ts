import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { runAdminPackRetrievalEvaluation } from "@/lib/admin-review-service";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";

type RouteContext = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;

  try {
    const result = await runAdminPackRetrievalEvaluation({
      packId: packId?.trim() ?? "",
      reviewerClientId: clientId,
    });

    if ("error" in result) {
      if (result.error === "NOT_FOUND") {
        return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, {
          status: 404,
        });
      }
      if (result.error === "NOT_EDITABLE") {
        return jsonWithClientIdCookie({ error: result.message }, clientId, { status: 409 });
      }
      if (result.error === "INCOMPLETE") {
        return jsonWithClientIdCookie({ error: result.message }, clientId, { status: 400 });
      }
    }

    return jsonWithClientIdCookie({ clientId, detail: result.detail }, clientId);
  } catch (error) {
    console.error("POST admin retrieval-evaluation run failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
