/**
 * Cursor Background Agent relay: base URL for `POST {base}/task-execute`.
 * Operators set once on the server; per-project `cursorApiUrl` in DB is legacy fallback only.
 */
export function resolveCursorRelayBaseUrl(storedCursorApiUrl: string | null | undefined): string {
  const env =
    (typeof process !== "undefined" && process.env.CURSOR_RELAY_BASE_URL?.trim()) ||
    (typeof process !== "undefined" && process.env.JY_CURSOR_RELAY_URL?.trim()) ||
    "";
  if (env) return env.replace(/\/+$/, "");
  return String(storedCursorApiUrl ?? "").trim().replace(/\/+$/, "");
}
