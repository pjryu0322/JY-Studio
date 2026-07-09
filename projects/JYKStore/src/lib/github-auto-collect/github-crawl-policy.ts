import type {
  GitHubCrawlMode,
  GitHubDiscoveryExcludedFile,
  GitHubDiscoverySourceCandidate,
  GitHubFileClass,
  GitHubSourceCodeAnalysisMode,
  GitHubTreeFileItem,
} from "./github-auto-collect-types";
import { classifyGitHubFilePath, isDocumentationClass } from "./github-file-classifier";

export function scoreGitHubFile(path: string, fileClass: GitHubFileClass): {
  score: number;
  reasonCodes: string[];
} {
  const norm = path.replace(/\\/g, "/");
  const base = norm.split("/").pop() ?? norm;
  const reasonCodes: string[] = [];
  let score = 0;

  const isRootReadme = /^readme(\.|$)/i.test(base) && !norm.includes("/");
  if (isRootReadme) {
    score += 100;
    reasonCodes.push("ROOT_README", "PRODUCT_OVERVIEW");
  } else if (fileClass === "README") {
    score += 90;
    reasonCodes.push("README");
  }

  if (fileClass === "GETTING_STARTED") {
    score += 90;
    reasonCodes.push("GETTING_STARTED");
  }
  if (fileClass === "DOCS") {
    score += 80;
    reasonCodes.push("DOCS_GUIDE");
  }
  if (fileClass === "API_DOC") {
    score += 75;
    reasonCodes.push("API_REFERENCE");
  }
  if (fileClass === "EXAMPLE") {
    score += 70;
    reasonCodes.push("EXAMPLE");
  }
  if (fileClass === "PACKAGE_MANIFEST") {
    score += 60;
    reasonCodes.push("PACKAGE_MANIFEST");
  }
  if (fileClass === "LICENSE") {
    score += 50;
    reasonCodes.push("LICENSE");
  }
  if (fileClass === "CONFIG") {
    score += 40;
    reasonCodes.push("CONFIG_EXAMPLE");
  }
  if (fileClass === "SRC" && /\/index\.(ts|js|tsx|jsx)$/i.test(norm)) {
    score += 35;
    reasonCodes.push("SRC_PUBLIC_ENTRYPOINT");
  }

  if (
    fileClass === "TEST" ||
    fileClass === "BUILD_ARTIFACT" ||
    fileClass === "GENERATED"
  ) {
    score -= 100;
    reasonCodes.push("LOW_VALUE_ARTIFACT");
  }
  if (fileClass === "BINARY" || fileClass === "LOCK_FILE" || norm.endsWith(".min.js")) {
    score -= 100;
    reasonCodes.push("BINARY_OR_LOCK");
  }

  return { score, reasonCodes };
}

function suggestSourceType(fileClass: GitHubFileClass): string {
  if (fileClass === "README") return "REPOSITORY_README";
  if (fileClass === "LICENSE") return "LICENSE_NOTICE";
  if (fileClass === "DOCS" || fileClass === "GETTING_STARTED") return "PRODUCT_MANUAL";
  if (fileClass === "API_DOC") return "OPENAPI_SCHEMA";
  if (fileClass === "EXAMPLE") return "SAMPLE_CODE";
  if (fileClass === "PACKAGE_MANIFEST") return "PACKAGE_MANIFEST";
  if (fileClass === "CONFIG") return "CONFIG_REFERENCE";
  if (fileClass === "SRC") return "SOURCE_CODE_METADATA";
  return "UNKNOWN";
}

function allowedByCrawlMode(fileClass: GitHubFileClass, crawlMode: GitHubCrawlMode): boolean {
  if (crawlMode === "DOCS_ONLY") {
    return isDocumentationClass(fileClass) || fileClass === "PACKAGE_MANIFEST";
  }
  if (crawlMode === "DOCS_AND_EXAMPLES") {
    return (
      isDocumentationClass(fileClass) ||
      fileClass === "EXAMPLE" ||
      fileClass === "PACKAGE_MANIFEST" ||
      fileClass === "CONFIG"
    );
  }
  return true;
}

function shouldExcludeForAnalysis(
  fileClass: GitHubFileClass,
  sourceCodeAnalysis: GitHubSourceCodeAnalysisMode,
): string | null {
  if (
    fileClass === "TEST" ||
    fileClass === "BUILD_ARTIFACT" ||
    fileClass === "GENERATED" ||
    fileClass === "BINARY" ||
    fileClass === "LOCK_FILE"
  ) {
    return "LOW_VALUE_OR_BINARY";
  }
  if (fileClass === "SRC" && sourceCodeAnalysis === "NONE") {
    return "SOURCE_CODE_ANALYSIS_DISABLED";
  }
  return null;
}

export function buildCandidateAndExcluded(params: {
  files: GitHubTreeFileItem[];
  crawlMode: GitHubCrawlMode;
  sourceCodeAnalysis: GitHubSourceCodeAnalysisMode;
  maxCandidateFiles: number;
}): {
  sourceCandidates: GitHubDiscoverySourceCandidate[];
  excludedFiles: GitHubDiscoveryExcludedFile[];
} {
  const { files, crawlMode, sourceCodeAnalysis, maxCandidateFiles } = params;
  const excluded: GitHubDiscoveryExcludedFile[] = [];
  const potential: GitHubDiscoverySourceCandidate[] = [];

  for (const file of files) {
    if (file.type !== "blob") continue;
    const size = file.size ?? 0;
    const fileClass = classifyGitHubFilePath(file.path);
    const { score, reasonCodes } = scoreGitHubFile(file.path, fileClass);

    if (!allowedByCrawlMode(fileClass, crawlMode)) {
      excluded.push({
        path: file.path,
        type: "blob",
        size,
        fileClass,
        excludeReason: "CRAWL_MODE_FILTER",
      });
      continue;
    }

    const excludeForAnalysis = shouldExcludeForAnalysis(fileClass, sourceCodeAnalysis);
    if (excludeForAnalysis) {
      excluded.push({
        path: file.path,
        type: "blob",
        size,
        fileClass,
        excludeReason: excludeForAnalysis,
      });
      continue;
    }

    if (score < 0) {
      excluded.push({
        path: file.path,
        type: "blob",
        size,
        fileClass,
        excludeReason: "LOW_SCORE",
      });
      continue;
    }

    const isSrc = fileClass === "SRC";
    const shouldFetchContent = isSrc
      ? sourceCodeAnalysis !== "NONE" && sourceCodeAnalysis !== "METADATA_ONLY"
      : true;

    potential.push({
      path: file.path,
      type: "blob",
      size,
      fileClass,
      score,
      reasonCodes:
        isSrc && sourceCodeAnalysis === "METADATA_ONLY"
          ? [...reasonCodes, "METADATA_ONLY"]
          : reasonCodes.length
            ? reasonCodes
            : ["CANDIDATE"],
      sourceTypeSuggestion: suggestSourceType(fileClass),
      shouldFetchContent,
    });
  }

  potential.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const sourceCandidates = potential.slice(0, maxCandidateFiles);
  for (const overflow of potential.slice(maxCandidateFiles)) {
    excluded.push({
      path: overflow.path,
      type: "blob",
      size: overflow.size,
      fileClass: overflow.fileClass,
      excludeReason: "MAX_CANDIDATE_FILES",
    });
  }

  return { sourceCandidates, excludedFiles: excluded };
}

export function buildClassificationSummary(
  files: GitHubTreeFileItem[],
): Partial<Record<GitHubFileClass, number>> {
  const summary: Partial<Record<GitHubFileClass, number>> = {};
  for (const file of files) {
    if (file.type !== "blob") continue;
    const fileClass = classifyGitHubFilePath(file.path);
    summary[fileClass] = (summary[fileClass] ?? 0) + 1;
  }
  return summary;
}
