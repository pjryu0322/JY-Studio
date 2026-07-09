import type {
  GitHubCrawlMode,
  GitHubDiscoveryExcludedFile,
  GitHubDiscoverySourceCandidate,
  GitHubFileClass,
  GitHubSourceCodeAnalysisMode,
  GitHubTreeFileItem,
  JykStoreSourceType,
} from "./github-auto-collect-types";
import { pathMatchesSelectedPaths } from "./github-discovery-options";
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
  if (fileClass === "SRC" && isSrcEntrypoint(norm)) {
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

export function isSrcEntrypoint(normPath: string): boolean {
  const norm = normPath.replace(/\\/g, "/");
  const patterns = [
    /^src\/index\.(ts|js|tsx|jsx)$/i,
    /^src\/main\.(ts|js)$/i,
    /^src\/App\.(tsx|jsx)$/i,
    /^lib\/index\.(ts|js)$/i,
    /^app\/page\.(tsx|jsx)$/i,
    /^app\/layout\.(tsx|jsx)$/i,
    /^packages\/[^/]+\/src\/index\.(ts|js)$/i,
  ];
  return patterns.some((re) => re.test(norm));
}

export function suggestSourceType(
  fileClass: GitHubFileClass,
  path: string,
): JykStoreSourceType {
  const lower = path.replace(/\\/g, "/").toLowerCase();
  if (fileClass === "README") return "PRODUCT_MANUAL";
  if (fileClass === "LICENSE") return "ETC";
  if (fileClass === "DOCS") return "PRODUCT_MANUAL";
  if (fileClass === "GETTING_STARTED") return "INTEGRATION_GUIDE";
  if (fileClass === "API_DOC") {
    if (
      lower.includes("openapi") ||
      lower.includes("swagger") ||
      lower.endsWith(".yaml") ||
      lower.endsWith(".yml") ||
      lower.endsWith(".json")
    ) {
      return "OPENAPI_SCHEMA";
    }
    return "API_SPEC";
  }
  if (fileClass === "EXAMPLE") return "SAMPLE_CODE";
  if (fileClass === "PACKAGE_MANIFEST") return "ETC";
  if (fileClass === "CONFIG") {
    if (
      lower.includes("application.properties") ||
      lower.includes("application-test") ||
      lower.includes(".env.example")
    ) {
      return "TEST_ENV_GUIDE";
    }
    return "OPERATION_GUIDE";
  }
  if (fileClass === "SRC") return "ETC";
  return "ETC";
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
  path: string,
  fileClass: GitHubFileClass,
  sourceCodeAnalysis: GitHubSourceCodeAnalysisMode,
  selectedPaths: string[],
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

  if (fileClass !== "SRC") {
    return null;
  }

  const norm = path.replace(/\\/g, "/");

  if (sourceCodeAnalysis === "NONE") {
    return "SOURCE_CODE_ANALYSIS_DISABLED";
  }

  if (sourceCodeAnalysis === "ENTRYPOINTS_ONLY") {
    return isSrcEntrypoint(norm) ? null : "SOURCE_CODE_ENTRYPOINTS_ONLY";
  }

  if (sourceCodeAnalysis === "SELECTED_PATHS") {
    if (selectedPaths.length === 0) {
      return "SOURCE_CODE_SELECTED_PATHS_REQUIRED";
    }
    if (!pathMatchesSelectedPaths(norm, selectedPaths)) {
      return "SOURCE_CODE_SELECTED_PATHS_ONLY";
    }
  }

  return null;
}

function resolveShouldFetchContent(
  fileClass: GitHubFileClass,
  sourceCodeAnalysis: GitHubSourceCodeAnalysisMode,
): boolean {
  if (fileClass !== "SRC") return true;
  if (
    sourceCodeAnalysis === "NONE" ||
    sourceCodeAnalysis === "METADATA_ONLY" ||
    sourceCodeAnalysis === "ENTRYPOINTS_ONLY" ||
    sourceCodeAnalysis === "SELECTED_PATHS"
  ) {
    return false;
  }
  return false;
}

export function buildCandidateAndExcluded(params: {
  files: GitHubTreeFileItem[];
  crawlMode: GitHubCrawlMode;
  sourceCodeAnalysis: GitHubSourceCodeAnalysisMode;
  maxCandidateFiles: number;
  selectedPaths?: string[];
}): {
  sourceCandidates: GitHubDiscoverySourceCandidate[];
  excludedFiles: GitHubDiscoveryExcludedFile[];
  selectedPathFilteredCount: number;
} {
  const {
    files,
    crawlMode,
    sourceCodeAnalysis,
    maxCandidateFiles,
    selectedPaths = [],
  } = params;
  const excluded: GitHubDiscoveryExcludedFile[] = [];
  const potential: GitHubDiscoverySourceCandidate[] = [];
  let selectedPathFilteredCount = 0;

  for (const file of files) {
    if (file.type !== "blob") continue;
    const size = file.size ?? 0;
    const fileClass = classifyGitHubFilePath(file.path);

    if (selectedPaths.length > 0 && !pathMatchesSelectedPaths(file.path, selectedPaths)) {
      selectedPathFilteredCount += 1;
      excluded.push({
        path: file.path,
        type: "blob",
        size,
        fileClass,
        excludeReason: "SELECTED_PATHS_FILTER",
      });
      continue;
    }

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

    const excludeForAnalysis = shouldExcludeForAnalysis(
      file.path,
      fileClass,
      sourceCodeAnalysis,
      selectedPaths,
    );
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
    const shouldFetchContent = resolveShouldFetchContent(fileClass, sourceCodeAnalysis);

    potential.push({
      path: file.path,
      type: "blob",
      size,
      fileClass,
      score,
      reasonCodes:
        isSrc &&
        (sourceCodeAnalysis === "METADATA_ONLY" ||
          sourceCodeAnalysis === "ENTRYPOINTS_ONLY" ||
          sourceCodeAnalysis === "SELECTED_PATHS")
          ? [...reasonCodes, "METADATA_ONLY"]
          : reasonCodes.length
            ? reasonCodes
            : ["CANDIDATE"],
      sourceTypeSuggestion: suggestSourceType(fileClass, file.path),
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

  return { sourceCandidates, excludedFiles: excluded, selectedPathFilteredCount };
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

export { normalizeDiscoveryOptions, pathMatchesSelectedPaths } from "./github-discovery-options";
