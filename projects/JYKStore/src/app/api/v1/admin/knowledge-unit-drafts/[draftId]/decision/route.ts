import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import {
  AdminKnowledgeUnitDraftError,
  decideAdminKnowledgeUnitDraft,
} from "@/lib/admin-knowledge-unit-draft-service";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  ADMIN_KNOWLEDGE_UNIT_DRAFT_DECISION_FAILED: "Knowledge Unit draft 결정을 처리하지 못했습니다.",
  NOT_FOUND: "초안을 찾을 수 없습니다.",
  NOT_DRAFT: "초안을 찾을 수 없습니다.",
  ALREADY_ACTIVE: "이미 활성화된 초안은 처리할 수 없습니다.",
  NOT_PENDING_REVIEW: "검토 대기 상태의 초안만 처리할 수 있습니다.",
  VALIDATION: "요청값이 올바르지 않습니다.",
  REJECTION_REASON_REQUIRED: "반려 사유를 입력해 주세요.",
};

async function parseJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as {
      decision?: string;
      memo?: string;
      rejectionReason?: string;
    };
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
    if (!body) {
      return jsonWithClientIdCookie(
        { error: "VALIDATION", message: ERROR_MESSAGES.VALIDATION },
        clientId,
        { status: 400 },
      );
    }

    const result = await decideAdminKnowledgeUnitDraft(clientId, {
      draftId: draftId?.trim() ?? "",
      decision: body.decision as "approve" | "reject",
      memo: body.memo,
      rejectionReason: body.rejectionReason,
    });

    return jsonWithClientIdCookie(result, clientId);
  } catch (error) {
    if (error instanceof AdminKnowledgeUnitDraftError) {
      const message = ERROR_MESSAGES[error.code] ?? error.message;
      return jsonWithClientIdCookie({ error: error.code, message }, clientId, { status: error.status });
    }
    logSafeRouteError({
      scope: "admin-route",
      method: "POST",
      path: "/api/v1/admin/knowledge-unit-drafts/[draftId]/decision",
      error,
    });
    return jsonWithClientIdCookie(
      {
        error: "ADMIN_KNOWLEDGE_UNIT_DRAFT_DECISION_FAILED",
        message: ERROR_MESSAGES.ADMIN_KNOWLEDGE_UNIT_DRAFT_DECISION_FAILED,
      },
      clientId,
      { status: 500 },
    );
  }
}
