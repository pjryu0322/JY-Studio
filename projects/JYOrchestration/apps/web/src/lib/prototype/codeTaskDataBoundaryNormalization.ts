import type { CodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { pathMatchesAnyPattern } from "@/lib/prototype/codeTaskFileBoundary";
import { normalizeCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundaryNormalize";
import {
  SAMPLE_DATA_OWNED_PATTERNS,
  WORKSPACE_SHELL_FORBIDDEN_FOR_OTHERS,
} from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import { SHELL_GLOBAL_RESTRICTED_PATTERNS } from "@/lib/prototype/codeTaskFileOwnershipPolicy";

export const DATA_BRANCH_FOUNDATION_FORBIDDEN_PATTERNS = [
  ...WORKSPACE_SHELL_FORBIDDEN_FOR_OTHERS,
  "index.html",
  "app/page.*",
  "app/layout.*",
  "src/app/page.*",
  "src/app/layout.*",
  "pages/index.*",
  "src/pages/index.*",
  "src/App.*",
  "src/main.*",
] as const;

export const DATA_BRANCH_OWNED_PATTERNS = [
  ...SAMPLE_DATA_OWNED_PATTERNS,
  "src/data/**",
  "src/data/samples/**",
  "src/data/mock/**",
  "src/fixtures/**",
  "public/sample-data/**",
  "public/mock-data/**",
] as const;

export type SanitizeDataBranchGroupFileBoundaryResult = Readonly<{
  readonly boundary: CodeTaskFileBoundaryV1;
  readonly warnings: readonly string[];
  readonly removedFiles: readonly string[];
  readonly blocked?: Readonly<{ readonly code: "blocked_data_boundary_has_no_data_files" }>;
}>;

function isDataOwnedPattern(path: string): boolean {
  return pathMatchesAnyPattern(path, DATA_BRANCH_OWNED_PATTERNS);
}

function isFoundationPatternForData(path: string): boolean {
  return pathMatchesAnyPattern(path, [
    ...DATA_BRANCH_FOUNDATION_FORBIDDEN_PATTERNS,
    ...SHELL_GLOBAL_RESTRICTED_PATTERNS,
  ]);
}

function filterAllowList(paths: readonly string[]): {
  readonly kept: readonly string[];
  readonly removed: readonly string[];
} {
  const kept: string[] = [];
  const removed: string[] = [];
  for (const raw of paths) {
    const p = String(raw ?? "").trim();
    if (!p) continue;
    if (isFoundationPatternForData(p)) {
      removed.push(p);
      continue;
    }
    kept.push(p);
  }
  return { kept, removed };
}

/** data branch group: foundation/shell 파일을 owned/expected에서 제거하고 forbidden에 추가한다. */
export function sanitizeDataBranchGroupFileBoundary(
  boundary: CodeTaskFileBoundaryV1,
): SanitizeDataBranchGroupFileBoundaryResult {
  const expected = filterAllowList(boundary.expectedFiles);
  const owned = filterAllowList(boundary.ownedFiles);
  const allowedGlobs = filterAllowList(boundary.allowedGlobs ?? []);

  const removedFiles = [...new Set([...expected.removed, ...owned.removed, ...allowedGlobs.removed])];
  const warnings: string[] = [];
  if (removedFiles.length) {
    warnings.push("data_boundary_removed_foundation_owned_files");
  }

  const mergedForbidden = [
    ...new Set([
      ...boundary.forbiddenFiles,
      ...DATA_BRANCH_FOUNDATION_FORBIDDEN_PATTERNS,
      ...removedFiles,
    ]),
  ];

  const nextBoundary = normalizeCodeTaskFileBoundaryV1({
    ...boundary,
    expectedFiles: expected.kept,
    ownedFiles: owned.kept,
    forbiddenFiles: mergedForbidden,
    ...(boundary.allowedGlobs || allowedGlobs.kept.length
      ? { allowedGlobs: allowedGlobs.kept }
      : {}),
  })!;

  const hasDataCandidate = [...nextBoundary.ownedFiles, ...nextBoundary.expectedFiles].some((p) =>
    isDataOwnedPattern(p),
  );
  if (!hasDataCandidate) {
    return {
      boundary: nextBoundary,
      warnings,
      removedFiles,
      blocked: { code: "blocked_data_boundary_has_no_data_files" },
    };
  }

  return { boundary: nextBoundary, warnings, removedFiles };
}

export function dataBranchFileBoundaryNeedsSanitize(boundary: CodeTaskFileBoundaryV1 | null | undefined): boolean {
  if (!boundary) return true;
  const allowSide = [...boundary.ownedFiles, ...boundary.expectedFiles, ...(boundary.allowedGlobs ?? [])];
  return allowSide.some((p) => isFoundationPatternForData(p));
}
