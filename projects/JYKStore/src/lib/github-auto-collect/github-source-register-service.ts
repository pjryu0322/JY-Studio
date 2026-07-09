import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  assertProviderPackEditableForClient,
  createSourceDocumentForProviderPack,
  getProviderPackForClient,
} from "@/lib/provider-pack-service";
import type { GitHubApiFetch } from "./github-api-client";
import { fetchRecursiveTree } from "./github-api-client";
import { fetchGitHubTextBlob } from "./github-content-fetcher";
import { GitHubDiscoveryError } from "./github-auto-collect-types";
import type {
  GitHubDiscoverySourceCandidate,
  GitHubSourceRegisterInput,
  GitHubSourceRegisterResult,
} from "./github-auto-collect-types";
import { detectGitHubProductProfile } from "./github-product-profile-detector";
import { discoverGitHubRepository } from "./github-repository-discovery-service";
import { normalizeGitHubSourceRegisterInput } from "./github-source-register-options";
import {
  basenamePath,
  buildGitHubBlobUrl,
  buildGitHubSourceTitle,
  inferMimeType,
  resolveSourceFormat,
  resolveSourceType,
  sha256Content,
} from "./github-source-mapping";
import { parseGitHubRepositoryUrl } from "./github-url";

const UNSUPPORTED_CLASSES = new Set([
  "TEST",
  "BUILD_ARTIFACT",
  "GENERATED",
  "BINARY",
  "LOCK_FILE",
]);

export type RegisterGitHubSourceDeps = {
  fetchImpl?: GitHubApiFetch;
  token?: string;
  createSourceDocument?: typeof createSourceDocumentForProviderPack;
  assertEditablePack?: typeof assertProviderPackEditableForClient;
};

function throwRegisterPreflightError(
  editable: {
    ok: false;
    error: "PROFILE_REQUIRED" | "NOT_FOUND" | "NOT_EDITABLE";
  },
): never {
  if (editable.error === "PROFILE_REQUIRED") {
    throw new GitHubDiscoveryError(
      "INVALID_SOURCE_REGISTER_OPTIONS",
      "Provider 프로필이 필요합니다.",
      400,
    );
  }
  if (editable.error === "NOT_FOUND") {
    throw new GitHubDiscoveryError(
      "INVALID_SOURCE_REGISTER_OPTIONS",
      "지식팩을 찾을 수 없습니다.",
      404,
    );
  }
  throw new GitHubDiscoveryError(
    "INVALID_SOURCE_REGISTER_OPTIONS",
    "초안(DRAFT) 상태에서만 등록할 수 있습니다.",
    409,
  );
}

function mapCreateError(message: string | undefined): string {
  const text = message ?? "VALIDATION_FAILED";
  if (/checksum|중복/i.test(text)) return "DUPLICATE_CHECKSUM";
  return "VALIDATION_FAILED";
}

export async function registerGitHubSourceDocumentsForPack(
  clientId: string,
  packId: string,
  input: GitHubSourceRegisterInput,
  deps: RegisterGitHubSourceDeps = {},
): Promise<GitHubSourceRegisterResult> {
  const warnings: string[] = [];
  const trimmedPackId = packId.trim();
  const normalized = normalizeGitHubSourceRegisterInput(input, warnings);
  const createSourceDocument = deps.createSourceDocument ?? createSourceDocumentForProviderPack;
  const fetchImpl = deps.fetchImpl;
  const token = deps.token ?? process.env.GITHUB_TOKEN;

  const assertEditable = deps.assertEditablePack ?? assertProviderPackEditableForClient;
  const editable = await assertEditable(clientId, trimmedPackId);
  if (!editable.ok) {
    throwRegisterPreflightError(editable);
  }
  const effectivePackId = editable.packId;

  const discovery = await discoverGitHubRepository(
    {
      repositoryUrl: normalized.repositoryUrl,
      crawlMode: normalized.crawlMode,
      sourceCodeAnalysis: normalized.sourceCodeAnalysis,
      selectedPaths: normalized.selectedPaths,
      maxFilesToAnalyze: normalized.maxFilesToAnalyze,
      maxCandidateFiles: normalized.maxCandidateFiles,
    },
    { fetchImpl, token },
  );

  const parsed = parseGitHubRepositoryUrl(normalized.repositoryUrl);
  const branch = parsed.ref ?? discovery.repository.defaultBranch;
  // TODO(P26.5-2): discovery may already include tree data; reuse it to avoid a second fetchRecursiveTree.
  const { items } = await fetchRecursiveTree(
    parsed.owner,
    parsed.repo,
    branch,
    { fetchImpl, token },
  );
  const shaByPath = new Map<string, string>();
  const sizeByPath = new Map<string, number>();
  for (const item of items) {
    if (item.type !== "blob" || !item.sha) continue;
    shaByPath.set(item.path, item.sha);
    sizeByPath.set(item.path, item.size ?? 0);
  }

  const candidateByPath = new Map<string, GitHubDiscoverySourceCandidate>();
  for (const c of discovery.sourceCandidates) {
    candidateByPath.set(c.path, c);
  }

  const productProfile =
    discovery.productProfile ??
    detectGitHubProductProfile({
      files: items,
      metadata: discovery.repository,
      classificationSummary: discovery.classificationSummary,
    });

  const registeredDocuments: GitHubSourceRegisterResult["registeredDocuments"] = [];
  const skippedFiles: GitHubSourceRegisterResult["skippedFiles"] = [];
  const failedFiles: GitHubSourceRegisterResult["failedFiles"] = [];
  let fetchedBytes = 0;
  let fetchCount = 0;
  let packDetail: ProviderPackDetailDto | undefined;

  for (const path of normalized.selectedSourcePaths) {
    const candidate = candidateByPath.get(path);
    if (!candidate) {
      skippedFiles.push({ path, reason: "NOT_A_DISCOVERY_CANDIDATE" });
      continue;
    }

    const fileClass = candidate.fileClass;
    if (UNSUPPORTED_CLASSES.has(fileClass)) {
      skippedFiles.push({ path, reason: "UNSUPPORTED_FILE_CLASS" });
      continue;
    }
    if (!candidate.shouldFetchContent) {
      skippedFiles.push({ path, reason: "CONTENT_FETCH_DISABLED" });
      continue;
    }

    if (fetchCount >= normalized.maxFilesToFetch) {
      skippedFiles.push({ path, reason: "MAX_FILES_TO_FETCH_EXCEEDED" });
      continue;
    }

    const sha = shaByPath.get(path);
    if (!sha) {
      skippedFiles.push({ path, reason: "MISSING_BLOB_SHA" });
      continue;
    }

    const blobSize = sizeByPath.get(path) ?? candidate.size;
    if (blobSize > normalized.maxFileBytes) {
      skippedFiles.push({ path, reason: "MAX_FILE_BYTES_EXCEEDED" });
      continue;
    }
    if (fetchedBytes + blobSize > normalized.maxTotalBytes) {
      skippedFiles.push({ path, reason: "MAX_TOTAL_BYTES_EXCEEDED" });
      continue;
    }

    let content: string;
    try {
      const fetched = await fetchGitHubTextBlob({
        owner: parsed.owner,
        repo: parsed.repo,
        path,
        sha,
        maxFileBytes: normalized.maxFileBytes,
        fetchImpl,
        token,
      });
      content = fetched.content;
      fetchedBytes += fetched.size;
      fetchCount += 1;
    } catch (error) {
      if (error instanceof GitHubDiscoveryError) {
        failedFiles.push({ path, error: error.code });
      } else {
        failedFiles.push({ path, error: "GITHUB_CONTENT_FETCH_FAILED" });
      }
      continue;
    }

    const sourceType = resolveSourceType(candidate.sourceTypeSuggestion);
    const sourceFormat = resolveSourceFormat(path, fileClass);
    const checksum = sha256Content(content);
    const title = buildGitHubSourceTitle(path, fileClass);
    const sourceUrl = buildGitHubBlobUrl(
      discovery.repository.repositoryUrl,
      branch,
      path,
    );

    const result = await createSourceDocument(clientId, effectivePackId, {
      title,
      sourceType,
      sourceFormat,
      sourceUrl,
      fileName: basenamePath(path),
      mimeType: inferMimeType(path),
      content,
      checksum,
      productVersion: normalized.productVersion,
      documentVersion: normalized.documentVersion ?? branch,
      licenseStatus: normalized.licenseStatus ?? discovery.repository.license ?? "UNKNOWN",
    });

    if ("error" in result && result.error) {
      if (result.error === "NOT_FOUND") {
        throw new GitHubDiscoveryError("INVALID_SOURCE_REGISTER_OPTIONS", "지식팩을 찾을 수 없습니다.", 404);
      }
      if (result.error === "NOT_EDITABLE") {
        throw new GitHubDiscoveryError(
          "INVALID_SOURCE_REGISTER_OPTIONS",
          "초안(DRAFT) 상태에서만 등록할 수 있습니다.",
          409,
        );
      }
      if (result.error === "PROFILE_REQUIRED") {
        throw new GitHubDiscoveryError(
          "INVALID_SOURCE_REGISTER_OPTIONS",
          "Provider 프로필이 필요합니다.",
          400,
        );
      }
      failedFiles.push({
        path,
        error: mapCreateError("message" in result ? result.message : undefined),
      });
      continue;
    }

    packDetail = result.pack;
    const createdDoc = result.pack?.versions?.[0]?.sourceDocuments?.find(
      (d) => d.title === title,
    );

    registeredDocuments.push({
      path,
      title,
      sourceType,
      sourceFormat,
      sourceUrl,
      checksum,
      validationStatus: createdDoc?.validationStatus,
    });
  }

  if (!packDetail) {
    packDetail = (await getProviderPackForClient(clientId, effectivePackId)) ?? undefined;
  }

  return {
    clientId,
    packId: effectivePackId,
    repository: discovery.repository,
    productProfile,
    summary: {
      selectedPathCount: normalized.selectedSourcePaths.length,
      registeredCount: registeredDocuments.length,
      skippedCount: skippedFiles.length,
      failedCount: failedFiles.length,
      fetchedBytes,
      maxFilesToFetch: normalized.maxFilesToFetch,
      maxFileBytes: normalized.maxFileBytes,
      maxTotalBytes: normalized.maxTotalBytes,
    },
    registeredDocuments,
    skippedFiles,
    failedFiles,
    warnings: [...discovery.warnings, ...warnings],
    pack: packDetail,
  };
}