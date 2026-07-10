import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import {
  activateAdminKnowledgeUnitDraft,
  AdminKnowledgeUnitDraftActivationError,
} from "@/lib/admin-knowledge-unit-draft-activation-service";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  ADMIN_KNOWLEDGE_UNIT_DRAFT_ACTIVATION_FAILED: "Knowledge Unit draft 활성화에 실패했습니다.",
  NOT_FOUND: "초안을 찾을 수 없습니다.",
  NOT_DRAFT: "초안을 찾을 수 없습니다.",
  ALREADY_ACTIVE: "이미 활성화된 초안은 처리할 수 없습니다.",
  NOT_APPROVED: "승인된 초안만 활성화할 수 있습니다.",
  ALREADY_ACTIVATED: "이미 활성화된 초안입니다.",
  VALIDATION: "요청값이 올바르지 않습니다.",
};

async function parseJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as { memo?: string };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;

  const { draftId } = await context.params;

  try {
    const body = await parseJsonBody(request);
    if (body === null) {
      return jsonWithClientIdCookie(
        { error: "VALIDATION", message: ERROR_MESSAGES.VALIDATION },
        clientId,
        { status: 400 },
      );
    }

    const result = await activateAdminKnowledgeUnitDraft(clientId, {
      draftId: draftId?.trim() ?? "",
      memo: body.memo,
    });

    return jsonWithClientIdCookie(result, clientId);
  } catch (error) {
    if (error instanceof AdminKnowledgeUnitDraftActivationError) {
      const message = ERROR_MESSAGES[error.code] ?? error.message;
      return jsonWithClientIdCookie({ error: error.code, message }, clientId, { status: error.status });
    }
    logSafeRouteError({
      scope: "admin-route",
      method: "POST",
      path: "/api/v1/admin/knowledge-unit-drafts/[draftId]/activate",
      error,
    });
    return jsonWithClientIdCookie(
      {
        error: "ADMIN_KNOWLEDGE_UNIT_DRAFT_ACTIVATION_FAILED",
        message: ERROR_MESSAGES.ADMIN_KNOWLEDGE_UNIT_DRAFT_ACTIVATION_FAILED,
      },
      clientId,
      { status: 500 },
    );
  }
}
