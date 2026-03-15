/**
 * Job upload helpers: extension detection, status rules, simulated storage paths.
 * No actual file storage in MVP.
 */

export const ALLOWED_EXTENSIONS = [
  "pdf",
] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export function getExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ext;
}

export function isAllowedExtension(ext: string): ext is AllowedExtension {
  return ALLOWED_EXTENSIONS.includes(ext as AllowedExtension);
}

export type JobStatusForUpload = "QUEUED";

export function getStatusForExtension(ext: string): JobStatusForUpload {
  void ext;
  return "QUEUED";
}

/** Simulated storage path (no actual file write in MVP). */
export function simulateStoragePath(jobId: string, kind: "original" | "replacement_pdf", ext: string): string {
  const filename = kind === "original" ? `original.${ext}` : "replacement.pdf";
  return `simulated/jobs/${jobId}/${filename}`;
}

export const PDF_MIME = "application/pdf";

export function isPdfMime(mime: string | null): boolean {
  if (!mime) return false;
  return mime.toLowerCase() === PDF_MIME;
}
