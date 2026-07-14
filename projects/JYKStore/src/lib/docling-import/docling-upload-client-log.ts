/**
 * Fire-and-forget client breadcrumbs → Next.js terminal via provider API.
 * Never sends file contents or presigned URLs.
 */

export async function logDoclingUploadClientEvent(
  packId: string,
  event: string,
  detail?: Record<string, unknown>,
  level: "info" | "warn" | "error" = "info",
): Promise<void> {
  try {
    void fetch(
      `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/client-log`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, level, detail: detail ?? {} }),
        keepalive: true,
      },
    ).catch(() => {
      // ignore — logging must never break upload
    });
  } catch {
    // ignore
  }
}
