/** Safe Content-Disposition filename for downloads (ASCII fallback + UTF-8). */
export function buildContentDisposition(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || "payload.zip";
  const ascii = base.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "payload.zip";
  const encoded = encodeURIComponent(base);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
