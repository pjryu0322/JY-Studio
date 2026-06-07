import {
  filePathPatternsOverlap,
  pathMatchesAnyPattern,
} from "@/lib/prototype/codeTaskFileBoundary";
import { WORKSPACE_SHELL_OWNED_PATTERNS } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import {
  FOUNDATION_ROUTE_APP_ENTRY_CANDIDATES,
  INTEGRATION_ROUTE_WIRING_CANDIDATES,
} from "@/lib/prototype/codeTaskRouteBoundaryPlanner";
import { SAMPLE_DATA_OWNED_PATTERNS } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import type { CodeTaskBranchGroupV1 } from "@/lib/prototype/implementationBranchPlan";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";

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

const DATA_BRANCH_OWNED_PATTERN_LIST = dedupePaths([
  ...SAMPLE_DATA_OWNED_PATTERNS,
  "src/data/**",
  "src/data/samples/**",
  "src/data/mock/**",
  "src/fixtures/**",
  "public/sample-data/**",
  "public/mock-data/**",
]) as readonly string[];

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

export function isDataBranchOwnedPattern(pattern: string): boolean {
  return pathMatchesAnyPattern(pattern, DATA_BRANCH_OWNED_PATTERN_LIST);
}

export function listShellGlobalOwnedViolations(input: {
  readonly branchGroup: CodeTaskBranchGroupV1;
  readonly ownedFiles: readonly string[];
  readonly allowedFiles?: readonly string[];
}): readonly string[] {
  if (input.branchGroup === "data") {
    return dedupePaths([...input.ownedFiles]).filter((p) => patternIsShellOrGlobalRestricted(p));
  }
  if (input.branchGroup === "foundation" || input.branchGroup === "integration") {
    return dedupePaths([...input.ownedFiles]).filter((p) => isDataBranchOwnedPattern(p));
  }
  if (canOwnShellGlobalFiles(input.branchGroup)) return [];
  return dedupePaths([...input.ownedFiles]).filter((p) => patternIsShellOrGlobalRestricted(p));
}

function branchGroupOfCodeTask(task: ImplementationCodeTaskV1): CodeTaskBranchGroupV1 | null {
  return parseCodeTaskBranchPlanV1(task.branchPlan)?.branchGroup ?? null;
}

function isIntegrationWiringCodeTask(task: ImplementationCodeTaskV1): boolean {
  const group = branchGroupOfCodeTask(task);
  if (group === "integration") return true;
  if (task.changeType === "integration") return true;
  if (task.codeTaskId === "CODE-DEV-INTEGRATION-001-001") return true;
  return /최종 연결|통합\s*wiring/i.test(task.title.trim());
}

/** P3-M61/M62: executing task owned ∩ peer forbidden expected mirror. */
export function isExpectedOwnerForbiddenMirrorOverlap(input: {
  readonly executingCodeTask: ImplementationCodeTaskV1;
  readonly peerCodeTask: ImplementationCodeTaskV1;
  readonly filePath: string;
  readonly reason?: string | null;
}): boolean {
  void input.reason;
  return isExpectedOwnerForbiddenMirrorOverlapByBranchGroup({
    executingBranchGroup: branchGroupOfCodeTask(input.executingCodeTask),
    peerBranchGroup: branchGroupOfCodeTask(input.peerCodeTask),
    filePath: input.filePath,
    executingIsIntegrationWiring: isIntegrationWiringCodeTask(input.executingCodeTask),
    peerIsIntegrationWiring: isIntegrationWiringCodeTask(input.peerCodeTask),
  });
}

export function isExpectedOwnerForbiddenMirrorOverlapByBranchGroup(input: {
  readonly executingBranchGroup: CodeTaskBranchGroupV1 | null;
  readonly peerBranchGroup: CodeTaskBranchGroupV1 | null;
  readonly filePath: string;
  readonly peerIsIntegrationWiring?: boolean;
  readonly executingIsIntegrationWiring?: boolean;
}): boolean {
  const execGroup = input.executingBranchGroup;
  const peerGroup = input.peerBranchGroup;
  const path = String(input.filePath ?? "").trim();
  if (!execGroup || !peerGroup || !path) return false;

  if (execGroup === "data" && peerGroup === "foundation") {
    return (
      isDataBranchOwnedPattern(path) ||
      patternIsShellOrGlobalRestricted(path)
    );
  }
  if (execGroup === "foundation" && peerGroup === "data") {
    return (
      isDataBranchOwnedPattern(path) ||
      patternIsShellOrGlobalRestricted(path)
    );
  }
  if (input.executingIsIntegrationWiring && patternIsShellOrGlobalRestricted(path)) {
    return peerGroup !== "integration";
  }
  return false;
}

export function findOwnedForbiddenInternalOverlaps(input: {
  readonly branchGroup?: CodeTaskBranchGroupV1 | null;
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
      const hit = a.includes("*") ? a : f.includes("*") ? f : a;
      if (
        input.branchGroup === "data" &&
        isDataBranchOwnedPattern(hit) &&
        patternIsShellOrGlobalRestricted(f) &&
        !patternIsShellOrGlobalRestricted(a)
      ) {
        continue;
      }
      if (
        input.branchGroup === "data" &&
        patternIsShellOrGlobalRestricted(a) &&
        patternIsShellOrGlobalRestricted(f) &&
        filePathPatternsOverlap(a, f)
      ) {
        continue;
      }
      hits.push(hit);
    }
  }
  return dedupePaths(hits);
}

export function branchGroupLabelKo(branchGroup: CodeTaskBranchGroupV1): string {
  return branchGroup;
}
