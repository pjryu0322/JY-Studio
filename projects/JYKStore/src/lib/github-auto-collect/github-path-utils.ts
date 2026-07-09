export function normalizeGitHubRepositoryPath(raw: string): string {
  return raw.trim().replace(/\\/g, "/").replace(/^\/+/g, "");
}

export function isUnsafeGitHubRepositoryPath(path: string): boolean {
  if (!path || path === "." || path === "..") return true;
  if (path.includes("..")) return true;
  if (/^[a-z]+:\/\//i.test(path)) return true;
  return false;
}

export function pathMatchesRequestedSourcePath(
  docPath: string,
  requestedPath: string,
): boolean {
  const doc = normalizeGitHubRepositoryPath(docPath);
  const requested = normalizeGitHubRepositoryPath(requestedPath);
  return (
    doc === requested ||
    doc.endsWith(`/${requested}`) ||
    doc.startsWith(`${requested}/`)
  );
}
