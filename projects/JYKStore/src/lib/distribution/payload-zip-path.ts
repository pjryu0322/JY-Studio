/** Shared ZIP path safety checks (no library dependency). */

export function findUnsafeZipPathReason(
  rawPath: string,
  maxPathLength = 300,
): string | null {
  if (!rawPath) {
    return "Empty ZIP entry path";
  }
  if (rawPath.includes("\0")) {
    return `NUL character in path: ${rawPath}`;
  }
  if (rawPath.length > maxPathLength) {
    return `Path exceeds ${maxPathLength} characters: ${rawPath.slice(0, 80)}…`;
  }

  const normalized = rawPath.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.startsWith("//")) {
    return `Absolute path not allowed: ${rawPath}`;
  }
  if (/^[a-zA-Z]:(\/|$)/.test(normalized) || /^[a-zA-Z]:\\/.test(rawPath)) {
    return `Drive-letter path not allowed: ${rawPath}`;
  }
  if (normalized.startsWith("//") || rawPath.startsWith("\\\\")) {
    return `UNC / network path not allowed: ${rawPath}`;
  }

  const parts = normalized.split("/");
  for (const part of parts) {
    if (part === "..") {
      return `Path traversal not allowed: ${rawPath}`;
    }
  }
  if (normalized.includes("../") || normalized.includes("/..") || normalized === "..") {
    return `Path traversal not allowed: ${rawPath}`;
  }

  return null;
}
