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

export type GitHubProductType =
  | "FRONTEND_COMPONENT"
  | "CHART_COMPONENT"
  | "BACKEND_FRAMEWORK"
  | "TEMPLATE_APP"
  | "SDK_LIBRARY"
  | "CLI_TOOL"
  | "INFRA_TOOL"
  | "DOCUMENTATION_ONLY"
  | "UNKNOWN";

export type GitHubProductProfileDetection = {
  primaryType: GitHubProductType;
  candidateTypes: Array<{
    type: GitHubProductType;
    score: number;
    confidence: number;
    evidence: string[];
  }>;
  confidence: number;
  evidence: string[];
  warnings: string[];
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
    topCandidateScore?: number;
    averageCandidateScore?: number;
    nonFetchableCandidateCount?: number;
  };
  classificationSummary: Partial<Record<GitHubFileClass, number>>;
  sourceCandidates: GitHubDiscoverySourceCandidate[];
  excludedFiles: GitHubDiscoveryExcludedFile[];
  warnings: string[];
  productProfileHint?: {
    likelyTypes: string[];
    evidence: string[];
  };
  productProfile?: GitHubProductProfileDetection;
};

export type GitHubSourceRegisterInput = {
  repositoryUrl: string;
  crawlMode?: GitHubCrawlMode;
  sourceCodeAnalysis?: GitHubSourceCodeAnalysisMode;
  selectedPaths?: string[];
  selectedSourcePaths: string[];
  maxFilesToAnalyze?: number;
  maxCandidateFiles?: number;
  maxFilesToFetch?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  productVersion?: string;
  documentVersion?: string;
  licenseStatus?: string;
};

export type GitHubSourceRegisterResult = {
  clientId: string;
  packId: string;
  repository: GitHubRepositoryMetadata;
  productProfile?: GitHubProductProfileDetection;
  summary: {
    selectedPathCount: number;
    registeredCount: number;
    skippedCount: number;
    failedCount: number;
    fetchedBytes: number;
    maxFilesToFetch: number;
    maxFileBytes: number;
    maxTotalBytes: number;
  };
  registeredDocuments: Array<{
    path: string;
    title: string;
    sourceType: string;
    sourceFormat: string;
    sourceUrl: string;
    checksum: string;
    validationStatus?: string;
  }>;
  skippedFiles: Array<{ path: string; reason: string }>;
  failedFiles: Array<{ path: string; error: string }>;
  warnings: string[];
  pack?: import("@/lib/provider-pack-dto").ProviderPackDetailDto;
};

export type GitHubKnowledgeUnitGenerationMode =
  | "MINIMAL"
  | "STANDARD"
  | "FULL"
  | "CUSTOM";

export type GitHubKnowledgeUnitDraftInput = {
  sourceDocumentIds?: string[];
  sourceDocumentPaths?: string[];
  generationMode?: GitHubKnowledgeUnitGenerationMode;
  targetKnowledgeUnitCount?: number;
  minKnowledgeUnitCount?: number;
  maxKnowledgeUnitCount?: number;
  productProfileType?: GitHubProductType;
  overwriteExistingDrafts?: boolean;
};

export type GitHubKnowledgeUnitDraftResult = {
  clientId: string;
  packId: string;
  versionId: string;
  summary: {
    sourceDocumentCount: number;
    generatedDraftCount: number;
    skippedDocumentCount: number;
    existingDraftSkippedCount: number;
    failedCount: number;
    generationMode: string;
    targetKnowledgeUnitCount: number;
  };
  drafts: Array<{
    id: string;
    sourceDocumentId: string;
    title: string;
    section: string | null;
    tags: string[];
    reviewStatus: "pending_review";
    generatedBy: "github-auto-collector";
    sourcePath?: string;
    sourceUrl?: string;
  }>;
  skippedDocuments: Array<{ sourceDocumentId: string; reason: string }>;
  failedDocuments: Array<{ sourceDocumentId: string; error: string }>;
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
  | "INVALID_SELECTED_PATHS"
  | "INVALID_DISCOVERY_OPTIONS"
  | "GITHUB_CONTENT_FETCH_FAILED"
  | "INVALID_SOURCE_REGISTER_OPTIONS"
  | "INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS"
  | "KNOWLEDGE_UNIT_DRAFT_FAILED";

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
