import type {
  GitHubDiscoverySourceCandidate,
  GitHubFileClass,
} from "./github-auto-collect-types";

const DEFAULT_AUTO_SELECT_FILE_CLASSES = new Set<GitHubFileClass>([
  "README",
  "GETTING_STARTED",
  "API_DOC",
  "DOCS",
  "EXAMPLE",
  "PACKAGE_MANIFEST",
  "CONFIG",
]);

export function selectDefaultGitHubSourceCandidatePaths(
  candidates: GitHubDiscoverySourceCandidate[],
  limit = 10,
): string[] {
  const eligible = candidates
    .filter(
      (c) =>
        c.shouldFetchContent &&
        c.fileClass !== "SRC" &&
        DEFAULT_AUTO_SELECT_FILE_CLASSES.has(c.fileClass),
    )
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const paths: string[] = [];
  const seen = new Set<string>();
  for (const candidate of eligible) {
    if (seen.has(candidate.path)) continue;
    seen.add(candidate.path);
    paths.push(candidate.path);
    if (paths.length >= limit) break;
  }
  return paths;
}

export function summarizeExcludedFilesByReason(
  excludedFiles: Array<{ excludeReason: string }>,
): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>();
  for (const file of excludedFiles) {
    const key = file.excludeReason || "UNKNOWN";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

export function clampUiNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export type UiSourceCodeAnalysisMode = "NONE" | "METADATA_ONLY" | "ENTRYPOINTS_ONLY";

export function normalizeUiSourceCodeAnalysis(value: string): UiSourceCodeAnalysisMode {
  if (value === "METADATA_ONLY" || value === "ENTRYPOINTS_ONLY") return value;
  return "NONE";
}
