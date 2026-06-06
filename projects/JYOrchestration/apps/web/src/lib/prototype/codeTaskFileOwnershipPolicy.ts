import {
  filePathPatternsOverlap,
  pathMatchesAnyPattern,
} from "@/lib/prototype/codeTaskFileBoundary";
import { WORKSPACE_SHELL_OWNED_PATTERNS } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import {
  FOUNDATION_ROUTE_APP_ENTRY_CANDIDATES,
  INTEGRATION_ROUTE_WIRING_CANDIDATES,
} from "@/lib/prototype/codeTaskRouteBoundaryPlanner";
import type { CodeTaskBranchGroupV1 } from "@/lib/prototype/implementationBranchPlan";

function dedupePaths(paths: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of paths) {
    const p = String(raw ?? "").trim();
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export const FOUNDATION_OWNED_FILE_PATTERNS = dedupePaths([
  ...FOUNDATION_ROUTE_APP_ENTRY_CANDIDATES,
  ...WORKSPACE_SHELL_OWNED_PATTERNS,
]) as readonly string[];

export const INTEGRATION_OWNED_FILE_PATTERNS = dedupePaths([
  ...INTEGRATION_ROUTE_WIRING_CANDIDATES,
  "app/index.html",
  ...WORKSPACE_SHELL_OWNED_PATTERNS,
]) as readonly string[];

/** data/common/feature/screen이 직접 소유하면 안 되는 Shell·route·global 패턴 */
export const SHELL_GLOBAL_RESTRICTED_PATTERNS = FOUNDATION_OWNED_FILE_PATTERNS;

export function canOwnShellGlobalFiles(branchGroup: CodeTaskBranchGroupV1): boolean {
  return branchGroup === "foundation" || branchGroup === "integration";
}

export function patternIsShellOrGlobalRestricted(pattern: string): boolean {
  return pathMatchesAnyPattern(pattern, SHELL_GLOBAL_RESTRICTED_PATTERNS);
}

export function listShellGlobalOwnedViolations(input: {
  readonly branchGroup: CodeTaskBranchGroupV1;
  readonly ownedFiles: readonly string[];
  readonly allowedFiles: readonly string[];
}): readonly string[] {
  if (canOwnShellGlobalFiles(input.branchGroup)) return [];
  const candidates = dedupePaths([...input.ownedFiles, ...input.allowedFiles]);
  return candidates.filter((p) => patternIsShellOrGlobalRestricted(p));
}

export function findOwnedForbiddenInternalOverlaps(input: {
  readonly ownedFiles: readonly string[];
  readonly allowedFiles: readonly string[];
  readonly forbiddenFiles: readonly string[];
  readonly forbiddenGlobs?: readonly string[];
  readonly allowedGlobs?: readonly string[];
}): readonly string[] {
  const allowSide = dedupePaths([
    ...input.ownedFiles,
    ...input.allowedFiles,
    ...(input.allowedGlobs ?? []),
  ]);
  const forbidSide = dedupePaths([
    ...input.forbiddenFiles,
    ...(input.forbiddenGlobs ?? []),
  ]);
  const hits: string[] = [];
  for (const a of allowSide) {
    for (const f of forbidSide) {
      if (!filePathPatternsOverlap(a, f)) continue;
      hits.push(a.includes("*") ? a : f.includes("*") ? f : a);
    }
  }
  return dedupePaths(hits);
}

export function branchGroupLabelKo(branchGroup: CodeTaskBranchGroupV1): string {
  return branchGroup;
}
