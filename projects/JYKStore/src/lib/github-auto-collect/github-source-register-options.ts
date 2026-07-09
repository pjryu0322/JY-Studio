import { GitHubDiscoveryError } from "./github-auto-collect-types";
import type { GitHubSourceRegisterInput } from "./github-auto-collect-types";

export const GITHUB_SOURCE_REGISTER_LIMITS = {
  maxFilesToFetch: { min: 1, max: 30, default: 10 },
  maxFileBytes: { min: 1024, max: 200_000, default: 200_000 },
  maxTotalBytes: { min: 1024, max: 2_000_000, default: 2_000_000 },
  maxSelectedSourcePaths: 50,
} as const;

export type NormalizedGitHubSourceRegisterInput = GitHubSourceRegisterInput & {
  maxFilesToFetch: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  selectedSourcePaths: string[];
};

function clampInt(
  value: number | undefined,
  spec: { min: number; max: number; default: number },
): number {
  if (value === undefined || Number.isNaN(value)) return spec.default;
  return Math.min(spec.max, Math.max(spec.min, Math.floor(value)));
}

export function normalizeGitHubSourceRegisterInput(
  input: GitHubSourceRegisterInput,
  warnings: string[],
): NormalizedGitHubSourceRegisterInput {
  if (!input.repositoryUrl?.trim()) {
    throw new GitHubDiscoveryError(
      "REPOSITORY_URL_REQUIRED",
      "repositoryUrl이 필요합니다.",
      400,
    );
  }
  if (!input.selectedSourcePaths?.length) {
    throw new GitHubDiscoveryError(
      "INVALID_SOURCE_REGISTER_OPTIONS",
      "selectedSourcePaths가 필요합니다.",
      400,
    );
  }

  const seen = new Set<string>();
  const selectedSourcePaths: string[] = [];
  for (const raw of input.selectedSourcePaths) {
    const trimmed = raw.trim().replace(/^\/+/, "");
    if (!trimmed) {
      throw new GitHubDiscoveryError(
        "INVALID_SOURCE_REGISTER_OPTIONS",
        "selectedSourcePaths에 빈 경로는 사용할 수 없습니다.",
        400,
      );
    }
    if (seen.has(trimmed)) {
      warnings.push(`selectedSourcePaths 중복 경로를 제거했습니다: ${trimmed}`);
      continue;
    }
    if (selectedSourcePaths.length >= GITHUB_SOURCE_REGISTER_LIMITS.maxSelectedSourcePaths) {
      warnings.push(
        `selectedSourcePaths는 최대 ${GITHUB_SOURCE_REGISTER_LIMITS.maxSelectedSourcePaths}개까지 허용됩니다.`,
      );
      break;
    }
    seen.add(trimmed);
    selectedSourcePaths.push(trimmed);
  }

  if (selectedSourcePaths.length === 0) {
    throw new GitHubDiscoveryError(
      "INVALID_SOURCE_REGISTER_OPTIONS",
      "selectedSourcePaths가 비어 있습니다.",
      400,
    );
  }

  return {
    ...input,
    repositoryUrl: input.repositoryUrl.trim(),
    selectedSourcePaths,
    maxFilesToFetch: clampInt(
      input.maxFilesToFetch,
      GITHUB_SOURCE_REGISTER_LIMITS.maxFilesToFetch,
    ),
    maxFileBytes: clampInt(input.maxFileBytes, GITHUB_SOURCE_REGISTER_LIMITS.maxFileBytes),
    maxTotalBytes: clampInt(input.maxTotalBytes, GITHUB_SOURCE_REGISTER_LIMITS.maxTotalBytes),
  };
}
