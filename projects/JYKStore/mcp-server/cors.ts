/**
 * Parse comma-separated Origin allowlist from env.
 * Empty / unset → empty list (caller may treat as localhost-only or no CORS headers).
 */
export function parseAllowedOrigins(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    ),
  ];
}

/**
 * Returns true when the request Origin is permitted.
 * - Empty allowlist: only missing Origin or localhost Origins.
 * - "*" in allowlist: any Origin (dev only; not recommended in production).
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes("*")) return true;
  if (allowedOrigins.length === 0) {
    try {
      const url = new URL(origin);
      return url.hostname === "localhost" || url.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }
  return allowedOrigins.includes(origin);
}
