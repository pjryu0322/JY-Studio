export function normalizeFileBoundaryPath(path: string): string {
  return String(path ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");
}

export function normalizeFileBoundaryPaths(paths: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of paths) {
    const normalized = normalizeFileBoundaryPath(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out.sort();
}
