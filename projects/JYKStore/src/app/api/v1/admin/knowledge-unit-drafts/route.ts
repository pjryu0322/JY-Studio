import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";
import {
  AdminKnowledgeUnitDraftError,
  listAdminKnowledgeUnitDrafts,
  parseAdminKnowledgeUnitDraftListQuery,
} from "@/lib/admin-knowledge-unit-draft-service";

const ERROR_MESSAGES: Record<string, string> = {
  ADMIN_KNOWLEDGE_UNIT_DRAFTS_FAILED: "Knowledge Unit draft를 불러오지 못했습니다.",
};

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminDeny = rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const query = parseAdminKnowledgeUnitDraftListQuery(new URL(request.url).searchParams);
    const result = await listAdminKnowledgeUnitDrafts(clientId, query);
    return jsonWithClientIdCookie(result, clientId);
  } catch (error) {
    if (error instanceof AdminKnowledgeUnitDraftError) {
      const message = ERROR_MESSAGES[error.code] ?? error.message;
      return jsonWithClientIdCookie({ error: error.code, message }, clientId, { status: error.status });
    }
    logSafeRouteError({
      scope: "admin-route",
      method: "GET",
      path: "/api/v1/admin/knowledge-unit-drafts",
      error,
    });
    return jsonWithClientIdCookie(
      {
        error: "ADMIN_KNOWLEDGE_UNIT_DRAFTS_FAILED",
        message: ERROR_MESSAGES.ADMIN_KNOWLEDGE_UNIT_DRAFTS_FAILED,
      },
      clientId,
      { status: 500 },
    );
  }
}
