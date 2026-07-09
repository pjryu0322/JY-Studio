import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { GitHubDiscoveryError } from "@/lib/github-auto-collect/github-auto-collect-types";
import type { GitHubRepositoryDiscoveryInput } from "@/lib/github-auto-collect/github-auto-collect-types";
import { discoverGitHubRepository } from "@/lib/github-auto-collect/github-repository-discovery-service";

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
};

export async function POST(request: NextRequest) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;

  try {
    const body = (await request.json()) as GitHubRepositoryDiscoveryInput;
    const result = await discoverGitHubRepository(body);
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
      path: "/api/v1/provider/github/repository-discovery",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      clientId,
      { status: 500 },
    );
  }
}
