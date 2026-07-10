import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import {
  listProviderKnowledgeUnitDrafts,
  parseKnowledgeUnitDraftListQuery,
  ProviderKnowledgeUnitDraftListError,
  resetProviderKnowledgeUnitDrafts,
  type KnowledgeUnitDraftResetScope,
} from "@/lib/provider-knowledge-unit-draft-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED: "Knowledge Unit 초안을 불러오지 못했습니다.",
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;
  const trimmedPackId = packId?.trim() ?? "";

  try {
    if (!trimmedPackId) {
      return jsonWithClientIdCookie(
        { error: "PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED", message: ERROR_MESSAGES.PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED },
        clientId,
        { status: 404 },
      );
    }

    const query = parseKnowledgeUnitDraftListQuery(new URL(request.url).searchParams);
    const result = await listProviderKnowledgeUnitDrafts(userId, clientId, trimmedPackId, query);
    return jsonWithClientIdCookie(result, clientId);
  } catch (error) {
    if (error instanceof ProviderKnowledgeUnitDraftListError) {
      const message = ERROR_MESSAGES[error.code] ?? error.message;
      return jsonWithClientIdCookie({ error: error.code, message }, clientId, { status: error.status });
    }
    logSafeRouteError({
      scope: "provider-route",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/knowledge-unit-drafts",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED", message: ERROR_MESSAGES.PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED },
      clientId,
      { status: 500 },
    );
  }
}

function parseResetScope(body: unknown): KnowledgeUnitDraftResetScope | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const scope = (body as Record<string, unknown>).scope;
  if (
    scope === "pending_review_only" ||
    scope === "pending_and_superseded" ||
    scope === "all_auto_generated"
  ) {
    return scope;
  }
  return undefined;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;
  const trimmedPackId = packId?.trim() ?? "";

  try {
    if (!trimmedPackId) {
      return jsonWithClientIdCookie(
        { error: "PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED", message: "지식팩을 찾을 수 없습니다." },
        clientId,
        { status: 404 },
      );
    }

    let scope: KnowledgeUnitDraftResetScope | undefined;
    try {
      const body = await request.json();
      scope = parseResetScope(body);
    } catch {
      scope = undefined;
    }

    const result = await resetProviderKnowledgeUnitDrafts(userId, clientId, trimmedPackId, { scope });
    return jsonWithClientIdCookie(result, clientId);
  } catch (error) {
    if (error instanceof ProviderKnowledgeUnitDraftListError) {
      const message = ERROR_MESSAGES[error.code] ?? error.message;
      return jsonWithClientIdCookie({ error: error.code, message }, clientId, { status: error.status });
    }
    logSafeRouteError({
      scope: "provider-route",
      method: "DELETE",
      path: "/api/v1/provider/packs/[packId]/knowledge-unit-drafts",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED", message: "Knowledge Unit 초안을 초기화하지 못했습니다." },
      clientId,
      { status: 500 },
    );
  }
}
