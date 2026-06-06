export const CODE_TASK_FILE_BOUNDARY_VERSION = "code_task_file_boundary_v1" as const;

export type CodeTaskFileBoundaryConfidence = "high" | "medium" | "low";

export type CodeTaskFileBoundaryV1 = Readonly<{
  readonly version: typeof CODE_TASK_FILE_BOUNDARY_VERSION;
  readonly expectedFiles: readonly string[];
  readonly ownedFiles: readonly string[];
  readonly forbiddenFiles: readonly string[];
  readonly allowedGlobs?: readonly string[];
  readonly forbiddenGlobs?: readonly string[];
  readonly sharedFiles?: readonly string[];
  readonly conflictGroupId?: string | null;
  readonly fileBoundaryConfidence?: CodeTaskFileBoundaryConfidence;
}>;

export function normalizeRepoPathPattern(path: string): string {
  return String(path ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
}

/** Simple glob: `*` matches within one path segment or suffix. */
export function filePathPatternsOverlap(a: string, b: string): boolean {
  const pa = normalizeRepoPathPattern(a).toLowerCase();
  const pb = normalizeRepoPathPattern(b).toLowerCase();
  if (!pa || !pb) return false;
  if (pa === pb) return true;
  const match = (pattern: string, path: string): boolean => {
    if (!pattern.includes("*")) return pattern === path || path.startsWith(`${pattern}/`);
    const re = new RegExp(
      `^${pattern
        .split("*")
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^/]*")}($|/|$)`,
      "i",
    );
    return re.test(path) || re.test(path.split("/").slice(0, pattern.split("/").length).join("/"));
  };
  return match(pa, pb) || match(pb, pa);
}

export function pathMatchesAnyPattern(path: string, patterns: readonly string[]): boolean {
  const p = normalizeRepoPathPattern(path);
  return patterns.some((pat) => filePathPatternsOverlap(pat, p));
}

export function parseCodeTaskFileBoundaryV1(raw: unknown): CodeTaskFileBoundaryV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const readList = (key: string): string[] =>
    Array.isArray(o[key])
      ? (o[key] as unknown[]).map((v) => normalizeRepoPathPattern(String(v ?? ""))).filter(Boolean)
      : [];
  const expectedFiles = readList("expectedFiles");
  const ownedFiles = readList("ownedFiles");
  const forbiddenFiles = readList("forbiddenFiles");
  if (!expectedFiles.length && !ownedFiles.length && !forbiddenFiles.length) return null;
  const conf = o.fileBoundaryConfidence;
  return {
    version: CODE_TASK_FILE_BOUNDARY_VERSION,
    expectedFiles,
    ownedFiles,
    forbiddenFiles,
    ...(readList("allowedGlobs").length ? { allowedGlobs: readList("allowedGlobs") } : {}),
    ...(readList("forbiddenGlobs").length ? { forbiddenGlobs: readList("forbiddenGlobs") } : {}),
    ...(readList("sharedFiles").length ? { sharedFiles: readList("sharedFiles") } : {}),
    ...(typeof o.conflictGroupId === "string" ? { conflictGroupId: o.conflictGroupId.trim() || null } : {}),
    ...(conf === "high" || conf === "medium" || conf === "low"
      ? { fileBoundaryConfidence: conf }
      : { fileBoundaryConfidence: "medium" as const }),
  };
}
