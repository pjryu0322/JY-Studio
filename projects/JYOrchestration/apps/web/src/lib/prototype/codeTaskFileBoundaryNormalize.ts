import type { CodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { normalizeFileBoundaryPaths } from "@/lib/prototype/fileBoundaryNormalizer";

export function normalizeCodeTaskFileBoundaryV1(
  boundary: CodeTaskFileBoundaryV1 | null | undefined,
): CodeTaskFileBoundaryV1 | null {
  if (!boundary) return null;
  return {
    ...boundary,
    expectedFiles: normalizeFileBoundaryPaths(boundary.expectedFiles ?? []),
    ownedFiles: normalizeFileBoundaryPaths(boundary.ownedFiles ?? []),
    forbiddenFiles: normalizeFileBoundaryPaths(boundary.forbiddenFiles ?? []),
    forbiddenGlobs: normalizeFileBoundaryPaths(boundary.forbiddenGlobs ?? []),
    sharedFiles: normalizeFileBoundaryPaths(boundary.sharedFiles ?? []),
    allowedGlobs: boundary.allowedGlobs
      ? normalizeFileBoundaryPaths(boundary.allowedGlobs)
      : undefined,
  };
}
