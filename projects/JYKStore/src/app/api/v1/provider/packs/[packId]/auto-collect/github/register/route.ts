import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { GitHubDiscoveryError } from "@/lib/github-auto-collect/github-auto-collect-types";
import type { GitHubSourceRegisterInput } from "@/lib/github-auto-collect/github-auto-collect-types";
import { registerGitHubSourceDocumentsForPack } from "@/lib/github-auto-collect/github-source-register-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  REPOSITORY_URL_REQUIRED: "repositoryUrl이 필요합니다.",
  INVALID_GITHUB_URL: "github.com 공개 Repository URL만 입력할 수 있습니다.",
  INVALID_REPOSITORY_URL: "owner와 repo를 추출할 수 없습니다.",
  PRIVATE_REPOSITORY_NOT_SUPPORTED: "비공개 Repository는 지원하지 않습니다.",
  REPOSITORY_NOT_FOUND: "Repository를 찾을 수 없습니다.",
  GITHUB_RATE_LIMITED: "GitHub API rate limit에 도달했습니다.",
  GITHUB_API_ERROR: "GitHub API 요청에 실패했습니다.",
  INVALID_SELECTED_PATHS: "selectedPaths가 올바르지 않습니다.",
  INVALID_DISCOVERY_OPTIONS: "GitHub Repository 분석 옵션이 올바르지 않습니다.",
  GITHUB_CONTENT_FETCH_FAILED: "GitHub 파일 원문을 가져오지 못했습니다.",
  INVALID_SOURCE_REGISTER_OPTIONS: "GitHub 원천 문서 등록 옵션이 올바르지 않습니다.",
};

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const { packId } = await context.params;
  const trimmedPackId = packId?.trim() ?? "";

  try {
    if (!trimmedPackId) {
      return jsonWithClientIdCookie(
        {
          error: "INVALID_SOURCE_REGISTER_OPTIONS",
          message: ERROR_MESSAGES.INVALID_SOURCE_REGISTER_OPTIONS,
        },
        clientId,
        { status: 400 },
      );
    }
    const body = (await request.json()) as GitHubSourceRegisterInput;
    const result = await registerGitHubSourceDocumentsForPack(
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
      path: "/api/v1/provider/packs/[packId]/auto-collect/github/register",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      clientId,
      { status: 500 },
    );
  }
}
