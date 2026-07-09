import {
  DEFAULT_GITHUB_DISCOVERY_OPTIONS,
  GitHubDiscoveryError,
} from "./github-auto-collect-types";
import type {
  GitHubCrawlMode,
  GitHubRepositoryDiscoveryInput,
  GitHubRepositoryDiscoveryResult,
  GitHubSourceCodeAnalysisMode,
} from "./github-auto-collect-types";
import type { GitHubApiFetch } from "./github-api-client";
import { fetchRecursiveTree, fetchRepositoryMetadata } from "./github-api-client";
import {
  buildCandidateAndExcluded,
  buildClassificationSummary,
} from "./github-crawl-policy";
import { limitFilesForAnalysis, splitTreeItems } from "./github-tree-crawler";
import { parseGitHubRepositoryUrl } from "./github-url";

const P26_1_PREVIEW_WARNING =
  "P26.1은 preview 전용입니다. SourceDocument와 Knowledge Unit은 생성하지 않습니다.";

const FULL_SRC_WARNING =
  "FULL_SRC 분석은 P26.7에서 구현 예정입니다. 이번 단계에서는 metadata-only로 처리합니다.";

export type DiscoverRepositoryDeps = {
  fetchImpl?: GitHubApiFetch;
  token?: string;
};

function normalizeOptions(input: GitHubRepositoryDiscoveryInput): {
  crawlMode: GitHubCrawlMode;
  sourceCodeAnalysis: GitHubSourceCodeAnalysisMode;
  maxFilesToAnalyze: number;
  maxCandidateFiles: number;
  selectedPaths?: string[];
} {
  return {
    crawlMode: input.crawlMode ?? DEFAULT_GITHUB_DISCOVERY_OPTIONS.crawlMode,
    sourceCodeAnalysis:
      input.sourceCodeAnalysis ?? DEFAULT_GITHUB_DISCOVERY_OPTIONS.sourceCodeAnalysis,
    maxFilesToAnalyze:
      input.maxFilesToAnalyze ?? DEFAULT_GITHUB_DISCOVERY_OPTIONS.maxFilesToAnalyze,
    maxCandidateFiles:
      input.maxCandidateFiles ?? DEFAULT_GITHUB_DISCOVERY_OPTIONS.maxCandidateFiles,
    selectedPaths: input.selectedPaths,
  };
}

export async function discoverGitHubRepository(
  input: GitHubRepositoryDiscoveryInput,
  deps: DiscoverRepositoryDeps = {},
): Promise<GitHubRepositoryDiscoveryResult> {
  if (!input.repositoryUrl?.trim()) {
    throw new GitHubDiscoveryError(
      "REPOSITORY_URL_REQUIRED",
      "repositoryUrl이 필요합니다.",
      400,
    );
  }

  const token = deps.token ?? process.env.GITHUB_TOKEN;
  const fetchImpl = deps.fetchImpl;
  const options = normalizeOptions(input);
  const warnings: string[] = [P26_1_PREVIEW_WARNING];

  if (options.sourceCodeAnalysis === "FULL_SRC") {
    warnings.push(FULL_SRC_WARNING);
    options.sourceCodeAnalysis = "METADATA_ONLY";
  }

  const parsed = parseGitHubRepositoryUrl(input.repositoryUrl);
  const { metadata } = await fetchRepositoryMetadata(parsed.owner, parsed.repo, {
    fetchImpl,
    token,
  });

  if (metadata.archived) {
    warnings.push("archived Repository입니다. 결과는 참고용으로만 사용하세요.");
  }

  const branch = parsed.ref ?? metadata.defaultBranch;
  const { items, truncated: treeTruncated } = await fetchRecursiveTree(
    parsed.owner,
    parsed.repo,
    branch,
    { fetchImpl, token },
  );

  const { files: allFiles, directories } = splitTreeItems(items);
  const { files: analyzedFiles, truncatedByLimit } = limitFilesForAnalysis(
    allFiles,
    options.maxFilesToAnalyze,
  );

  const truncated = treeTruncated || truncatedByLimit;
  if (treeTruncated) {
    warnings.push("GitHub tree 응답이 truncated되었습니다. 일부 파일이 누락될 수 있습니다.");
  }
  if (truncatedByLimit) {
    warnings.push(
      `maxFilesToAnalyze(${options.maxFilesToAnalyze}) 한도로 파일 분석이 잘렸습니다.`,
    );
  }

  const classificationSummary = buildClassificationSummary(analyzedFiles);
  const { sourceCandidates, excludedFiles } = buildCandidateAndExcluded({
    files: analyzedFiles,
    crawlMode: options.crawlMode,
    sourceCodeAnalysis: options.sourceCodeAnalysis,
    maxCandidateFiles: options.maxCandidateFiles,
  });

  return {
    repository: metadata,
    options: {
      crawlMode: options.crawlMode,
      sourceCodeAnalysis: options.sourceCodeAnalysis,
      maxFilesToAnalyze: options.maxFilesToAnalyze,
      maxCandidateFiles: options.maxCandidateFiles,
      selectedPaths: options.selectedPaths,
    },
    summary: {
      totalFilesDiscovered: allFiles.length,
      totalDirectoriesDiscovered: directories.length,
      candidateFileCount: sourceCandidates.length,
      excludedFileCount: excludedFiles.length,
      truncated,
    },
    classificationSummary,
    sourceCandidates,
    excludedFiles,
    warnings,
  };
}
