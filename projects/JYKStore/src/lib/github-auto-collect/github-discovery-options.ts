import type { GitHubRepositoryDiscoveryInput } from "./github-auto-collect-types";
import { GitHubDiscoveryError } from "./github-auto-collect-types";

export const GITHUB_DISCOVERY_LIMITS = {
  maxFilesToAnalyze: { min: 100, max: 10000, default: 5000 },
  maxCandidateFiles: { min: 10, max: 300, default: 100 },
  maxSelectedPaths: 50,
} as const;

export type NormalizedDiscoveryOptions = {
  crawlMode: NonNullable<GitHubRepositoryDiscoveryInput["crawlMode"]>;
  sourceCodeAnalysis: NonNullable<GitHubRepositoryDiscoveryInput["sourceCodeAnalysis"]>;
  maxFilesToAnalyze: number;
  maxCandidateFiles: number;
  selectedPaths: string[];
};

function clampInt(
  value: number | undefined,
  spec: { min: number; max: number; default: number },
  label: string,
  warnings: string[],
): number {
  if (value === undefined || Number.isNaN(value)) {
    return spec.default;
  }
  if (value > spec.max) {
    warnings.push(`${label}가 허용 범위를 초과해 ${spec.max}으로 조정되었습니다.`);
    return spec.max;
  }
  if (value < spec.min) {
    warnings.push(`${label}가 허용 범위보다 작아 ${spec.min}으로 조정되었습니다.`);
    return spec.min;
  }
  return Math.floor(value);
}

function isUnsafeSelectedPath(segment: string): boolean {
  if (!segment || segment === "." || segment === "..") return true;
  if (segment.includes("..")) return true;
  if (/^[a-z]+:\/\//i.test(segment)) return true;
  return false;
}

export function normalizeSelectedPaths(
  raw: string[] | undefined,
  warnings: string[],
): string[] {
  if (!raw?.length) return [];

  const normalized: string[] = [];
  for (const entry of raw) {
    if (normalized.length >= GITHUB_DISCOVERY_LIMITS.maxSelectedPaths) {
      warnings.push(
        `selectedPaths는 최대 ${GITHUB_DISCOVERY_LIMITS.maxSelectedPaths}개까지 허용됩니다. 초과 항목은 무시되었습니다.`,
      );
      break;
    }
    const trimmed = entry.trim().replace(/^\/+/, "");
    if (!trimmed) {
      throw new GitHubDiscoveryError(
        "INVALID_SELECTED_PATHS",
        "selectedPaths에 빈 경로는 사용할 수 없습니다.",
        400,
      );
    }
    if (isUnsafeSelectedPath(trimmed)) {
      throw new GitHubDiscoveryError(
        "INVALID_SELECTED_PATHS",
        "selectedPaths에 허용되지 않는 경로가 포함되어 있습니다.",
        400,
      );
    }
    normalized.push(trimmed);
  }
  return normalized;
}

export function normalizeDiscoveryOptions(
  input: GitHubRepositoryDiscoveryInput,
  warnings: string[],
): NormalizedDiscoveryOptions {
  const selectedPaths = normalizeSelectedPaths(input.selectedPaths, warnings);

  return {
    crawlMode: input.crawlMode ?? "FULL_REPO_SCAN",
    sourceCodeAnalysis: input.sourceCodeAnalysis ?? "NONE",
    maxFilesToAnalyze: clampInt(
      input.maxFilesToAnalyze,
      GITHUB_DISCOVERY_LIMITS.maxFilesToAnalyze,
      "maxFilesToAnalyze",
      warnings,
    ),
    maxCandidateFiles: clampInt(
      input.maxCandidateFiles,
      GITHUB_DISCOVERY_LIMITS.maxCandidateFiles,
      "maxCandidateFiles",
      warnings,
    ),
    selectedPaths,
  };
}

export function pathMatchesSelectedPaths(filePath: string, selectedPaths: string[]): boolean {
  if (selectedPaths.length === 0) return true;
  const norm = filePath.replace(/\\/g, "/");
  return selectedPaths.some((sel) => norm === sel || norm.startsWith(`${sel}/`));
}
