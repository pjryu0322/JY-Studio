function readString(value: unknown): string {
  return String(value ?? "").trim();
}

export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** True when the string looks like an absolute http(s) preview URL. */
export function isLikelyPreviewUrl(url: string): boolean {
  const u = readString(url);
  return u.length > 0 && isHttpUrl(u);
}

export function isGithubPagesPreviewUrl(url: string): boolean {
  const u = url.trim();
  if (!isHttpUrl(u)) return false;
  try {
    const host = new URL(u).hostname.toLowerCase();
    return host.endsWith(".github.io");
  } catch {
    return /\.github\.io(\/|$)/i.test(u);
  }
}

export function isExternalPreviewUrl(url: string): boolean {
  const u = readString(url);
  if (!isHttpUrl(u)) return false;
  try {
    const host = new URL(u).hostname.toLowerCase();
    if (isGithubPagesPreviewUrl(u)) return true;
    if (host.endsWith(".pages.dev")) return true;
    if (host.endsWith(".vercel.app")) return true;
    if (host.endsWith(".netlify.app")) return true;
    return true;
  } catch {
    return true;
  }
}

export function isInternalPreviewUrl(url: string): boolean {
  const u = readString(url);
  if (!u) return false;
  if (isExternalPreviewUrl(u)) return false;
  if (u.startsWith("/")) return true;
  if (typeof window !== "undefined") {
    try {
      const parsed = new URL(u, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch {
      return false;
    }
  }
  return !isHttpUrl(u);
}

/** Node/test-safe internal path check (no window). */
export function isInternalPreviewPath(url: string): boolean {
  const u = readString(url);
  if (!u) return false;
  if (isExternalPreviewUrl(u)) return false;
  return u.startsWith("/") || (!isHttpUrl(u) && !u.includes("://"));
}
