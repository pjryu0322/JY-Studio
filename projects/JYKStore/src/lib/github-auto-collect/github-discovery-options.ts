import type {
  GitHubCrawlMode,
  GitHubRepositoryDiscoveryInput,
  GitHubSourceCodeAnalysisMode,
} from "./github-auto-collect-types";
import { DEFAULT_GITHUB_DISCOVERY_OPTIONS, GitHubDiscoveryError } from "./github-auto-collect-types";
import {
  isUnsafeGitHubRepositoryPath,
  normalizeGitHubRepositoryPath,
} from "./github-path-utils";

export const GITHUB_DISCOVERY_LIMITS = {
  maxFilesToAnalyze: { min: 100, max: 10000, default: 5000 },
  maxCandidateFiles: { min: 10, max: 300, default: 100 },
  maxSelectedPaths: 50,
} as const;

const ALLOWED_CRAWL_MODES = new Set<GitHubCrawlMode>([
  "DOCS_ONLY",
  "DOCS_AND_EXAMPLES",
  "FULL_REPO_SCAN",
]);

const ALLOWED_SOURCE_CODE_ANALYSIS_MODES = new Set<GitHubSourceCodeAnalysisMode>([
  "NONE",
  "METADATA_ONLY",
  "ENTRYPOINTS_ONLY",
  "FULL_SRC",
  "SELECTED_PATHS",
]);

const CRAWL_MODE_LABELS = [...ALLOWED_CRAWL_MODES].join(", ");
const SOURCE_CODE_ANALYSIS_LABELS = [...ALLOWED_SOURCE_CODE_ANALYSIS_MODES].join(", ");

export function normalizeCrawlMode(value: unknown): GitHubCrawlMode {
  if (value === undefined) {
    return DEFAULT_GITHUB_DISCOVERY_OPTIONS.crawlMode;
  }
  if (typeof value !== "string" || !ALLOWED_CRAWL_MODES.has(value as GitHubCrawlMode)) {
    throw new GitHubDiscoveryError(
      "INVALID_DISCOVERY_OPTIONS",
      `crawlMode가 올바르지 않습니다. 허용값: ${CRAWL_MODE_LABELS}`,
      400,
    );
  }
  return value as GitHubCrawlMode;
}

export function normalizeSourceCodeAnalysis(
  value: unknown,
): GitHubSourceCodeAnalysisMode {
  if (value === undefined) {
    return DEFAULT_GITHUB_DISCOVERY_OPTIONS.sourceCodeAnalysis;
  }
  if (
    typeof value !== "string" ||
    !ALLOWED_SOURCE_CODE_ANALYSIS_MODES.has(value as GitHubSourceCodeAnalysisMode)
  ) {
    throw new GitHubDiscoveryError(
      "INVALID_DISCOVERY_OPTIONS",
      `sourceCodeAnalysis가 올바르지 않습니다. 허용값: ${SOURCE_CODE_ANALYSIS_LABELS}`,
      400,
    );
  }
  return value as GitHubSourceCodeAnalysisMode;
}

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
  return isUnsafeGitHubRepositoryPath(segment);
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
    const trimmed = normalizeGitHubRepositoryPath(entry);
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
    crawlMode: normalizeCrawlMode(input.crawlMode),
    sourceCodeAnalysis: normalizeSourceCodeAnalysis(input.sourceCodeAnalysis),
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
