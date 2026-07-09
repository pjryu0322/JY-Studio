import type {
  GitHubRepositoryDiscoveryInput,
  GitHubRepositoryDiscoveryResult,
  GitHubSourceCodeAnalysisMode,
} from "./github-auto-collect-types";
import { GitHubDiscoveryError } from "./github-auto-collect-types";
import type { GitHubApiFetch } from "./github-api-client";
import { fetchRecursiveTree, fetchRepositoryMetadata } from "./github-api-client";
import {
  buildCandidateAndExcluded,
  buildClassificationSummary,
} from "./github-crawl-policy";
import { normalizeDiscoveryOptions } from "./github-discovery-options";
import { buildProductProfileHint, detectGitHubProductProfile } from "./github-product-profile-detector";
import { limitFilesForAnalysis, splitTreeItems } from "./github-tree-crawler";
import { parseGitHubRepositoryUrl } from "./github-url";

const P26_PREVIEW_WARNING =
  "P26 preview 전용입니다. SourceDocument와 Knowledge Unit은 생성하지 않습니다.";

const FULL_SRC_WARNING =
  "FULL_SRC 분석은 P26.7에서 구현 예정입니다. 이번 단계에서는 metadata-only로 처리합니다.";

export type DiscoverRepositoryDeps = {
  fetchImpl?: GitHubApiFetch;
  token?: string;
};

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
  const warnings: string[] = [P26_PREVIEW_WARNING];

  const options = normalizeDiscoveryOptions(input, warnings);

  let appliedSourceCodeAnalysis: GitHubSourceCodeAnalysisMode = options.sourceCodeAnalysis;
  if (appliedSourceCodeAnalysis === "FULL_SRC") {
    warnings.push(FULL_SRC_WARNING);
    appliedSourceCodeAnalysis = "METADATA_ONLY";
  }

  if (
    appliedSourceCodeAnalysis === "SELECTED_PATHS" &&
    options.selectedPaths.length === 0
  ) {
    warnings.push(
      "sourceCodeAnalysis=SELECTED_PATHS이지만 selectedPaths가 비어 있습니다. SRC 파일은 제외됩니다.",
    );
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
  const { sourceCandidates, excludedFiles, selectedPathFilteredCount } =
    buildCandidateAndExcluded({
      files: analyzedFiles,
      crawlMode: options.crawlMode,
      sourceCodeAnalysis: appliedSourceCodeAnalysis,
      maxCandidateFiles: options.maxCandidateFiles,
      selectedPaths: options.selectedPaths,
    });

  const sourceCandidateFetchableCount = sourceCandidates.filter(
    (c) => c.shouldFetchContent,
  ).length;
  const srcCandidateCount = sourceCandidates.filter((c) => c.fileClass === "SRC").length;
  const nonFetchableCandidateCount = sourceCandidates.filter((c) => !c.shouldFetchContent).length;
  const candidateScores = sourceCandidates.map((c) => c.score);
  const topCandidateScore =
    candidateScores.length > 0 ? Math.max(...candidateScores) : undefined;
  const averageCandidateScore =
    candidateScores.length > 0
      ? candidateScores.reduce((a, b) => a + b, 0) / candidateScores.length
      : undefined;

  const productProfileHint = buildProductProfileHint(analyzedFiles, metadata);
  const productProfile = detectGitHubProductProfile({
    files: analyzedFiles,
    metadata,
    classificationSummary,
  });

  return {
    repository: metadata,
    options: {
      crawlMode: options.crawlMode,
      sourceCodeAnalysis: appliedSourceCodeAnalysis,
      maxFilesToAnalyze: options.maxFilesToAnalyze,
      maxCandidateFiles: options.maxCandidateFiles,
      selectedPaths: options.selectedPaths.length ? options.selectedPaths : undefined,
    },
    summary: {
      totalFilesDiscovered: allFiles.length,
      totalDirectoriesDiscovered: directories.length,
      candidateFileCount: sourceCandidates.length,
      excludedFileCount: excludedFiles.length,
      truncated,
      selectedPathFilteredCount,
      sourceCandidateFetchableCount,
      srcCandidateCount,
      topCandidateScore,
      averageCandidateScore,
      nonFetchableCandidateCount,
    },
    classificationSummary,
    sourceCandidates,
    excludedFiles,
    warnings,
    productProfileHint,
    productProfile,
  };
}
