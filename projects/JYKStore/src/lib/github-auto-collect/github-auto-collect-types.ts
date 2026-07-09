export type GitHubCrawlMode =
  | "DOCS_ONLY"
  | "DOCS_AND_EXAMPLES"
  | "FULL_REPO_SCAN";

export type GitHubSourceCodeAnalysisMode =
  | "NONE"
  | "METADATA_ONLY"
  | "ENTRYPOINTS_ONLY"
  | "FULL_SRC"
  | "SELECTED_PATHS";

export type GitHubRepositoryDiscoveryInput = {
  repositoryUrl: string;
  crawlMode?: GitHubCrawlMode;
  sourceCodeAnalysis?: GitHubSourceCodeAnalysisMode;
  selectedPaths?: string[];
  maxFilesToAnalyze?: number;
  maxCandidateFiles?: number;
};

export const DEFAULT_GITHUB_DISCOVERY_OPTIONS = {
  crawlMode: "FULL_REPO_SCAN" as GitHubCrawlMode,
  sourceCodeAnalysis: "NONE" as GitHubSourceCodeAnalysisMode,
  maxFilesToAnalyze: 5000,
  maxCandidateFiles: 100,
};

export type ParsedGitHubRepositoryUrl = {
  owner: string;
  repo: string;
  normalizedRepositoryUrl: string;
  inputUrl: string;
  ref?: string;
  path?: string;
};

export type GitHubFileClass =
  | "README"
  | "LICENSE"
  | "DOCS"
  | "GETTING_STARTED"
  | "API_DOC"
  | "EXAMPLE"
  | "PACKAGE_MANIFEST"
  | "CONFIG"
  | "SRC"
  | "TEST"
  | "BUILD_ARTIFACT"
  | "BINARY"
  | "LOCK_FILE"
  | "GENERATED"
  | "UNKNOWN";

export type GitHubTreeItemType = "blob" | "tree";

export type GitHubTreeFileItem = {
  path: string;
  type: GitHubTreeItemType;
  size: number | null;
  sha?: string;
};

export type GitHubRepositoryMetadata = {
  owner: string;
  repo: string;
  fullName: string;
  repositoryUrl: string;
  defaultBranch: string;
  visibility: "public";
  archived: boolean;
  license: string | null;
  description?: string | null;
  language?: string | null;
};

export type JykStoreSourceType =
  | "PRODUCT_MANUAL"
  | "INTEGRATION_GUIDE"
  | "API_SPEC"
  | "OPENAPI_SCHEMA"
  | "ERROR_CODE_TABLE"
  | "SAMPLE_CODE"
  | "FAQ"
  | "RELEASE_NOTE"
  | "SECURITY_GUIDE"
  | "TEST_ENV_GUIDE"
  | "OPERATION_GUIDE"
  | "CALLBACK_GUIDE"
  | "TROUBLESHOOTING"
  | "ETC";

export type GitHubDiscoverySourceCandidate = {
  path: string;
  type: GitHubTreeItemType;
  size: number;
  fileClass: GitHubFileClass;
  score: number;
  reasonCodes: string[];
  sourceTypeSuggestion: JykStoreSourceType;
  shouldFetchContent: boolean;
};

export type GitHubDiscoveryExcludedFile = {
  path: string;
  type: GitHubTreeItemType;
  size: number;
  fileClass: GitHubFileClass;
  excludeReason: string;
};

export type GitHubRepositoryDiscoveryResult = {
  repository: GitHubRepositoryMetadata;
  options: Required<
    Pick<
      GitHubRepositoryDiscoveryInput,
      "crawlMode" | "sourceCodeAnalysis" | "maxFilesToAnalyze" | "maxCandidateFiles"
    >
  > & { selectedPaths?: string[] };
  summary: {
    totalFilesDiscovered: number;
    totalDirectoriesDiscovered: number;
    candidateFileCount: number;
    excludedFileCount: number;
    truncated: boolean;
    selectedPathFilteredCount?: number;
    sourceCandidateFetchableCount?: number;
    srcCandidateCount?: number;
  };
  classificationSummary: Partial<Record<GitHubFileClass, number>>;
  sourceCandidates: GitHubDiscoverySourceCandidate[];
  excludedFiles: GitHubDiscoveryExcludedFile[];
  warnings: string[];
};

export type GitHubDiscoveryErrorCode =
  | "REPOSITORY_URL_REQUIRED"
  | "INVALID_GITHUB_URL"
  | "INVALID_REPOSITORY_URL"
  | "PRIVATE_REPOSITORY_NOT_SUPPORTED"
  | "REPOSITORY_NOT_FOUND"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_API_ERROR"
  | "INVALID_SELECTED_PATHS";

export class GitHubDiscoveryError extends Error {
  readonly code: GitHubDiscoveryErrorCode;
  readonly status: number;

  constructor(code: GitHubDiscoveryErrorCode, message: string, status: number) {
    super(message);
    this.name = "GitHubDiscoveryError";
    this.code = code;
    this.status = status;
  }
}
