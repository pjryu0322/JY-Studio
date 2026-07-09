import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { GitHubDiscoveryError } from "@/lib/github-auto-collect/github-auto-collect-types";
import type { GitHubKnowledgeUnitDraftInput } from "@/lib/github-auto-collect/github-auto-collect-types";
import { generateGitHubKnowledgeUnitDraftsForPack } from "@/lib/github-auto-collect/github-knowledge-unit-draft-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS: "Knowledge Unit 초안 생성 옵션이 올바르지 않습니다.",
  KNOWLEDGE_UNIT_DRAFT_FAILED: "Knowledge Unit 초안 생성에 실패했습니다.",
};

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const { packId } = await context.params;
  const trimmedPackId = packId?.trim() ?? "";

  try {
    if (!trimmedPackId) {
      return jsonWithClientIdCookie(
        {
          error: "INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS",
          message: ERROR_MESSAGES.INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS,
        },
        clientId,
        { status: 400 },
      );
    }
    const body = (await request.json()) as GitHubKnowledgeUnitDraftInput;
    const result = await generateGitHubKnowledgeUnitDraftsForPack(
      clientId,
      trimmedPackId,
      body,
    );
    return jsonWithClientIdCookie(result, clientId);
  } catch (error) {
    if (error instanceof GitHubDiscoveryError) {
      const message = ERROR_MESSAGES[error.code] ?? error.message;
      return jsonWithClientIdCookie(
        { error: error.code, message },
        clientId,
        { status: error.status },
      );
    }
    logSafeRouteError({
      scope: "provider-route",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/auto-collect/github/knowledge-units/draft",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "KNOWLEDGE_UNIT_DRAFT_FAILED", message: ERROR_MESSAGES.KNOWLEDGE_UNIT_DRAFT_FAILED },
      clientId,
      { status: 500 },
    );
  }
}
