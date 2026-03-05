/**
 * Job upload helpers: extension detection, status rules, simulated storage paths.
 * No actual file storage in MVP.
 */

export const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "md",
  "hwp",
  "hwpx",
] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

const HWP_EXTENSIONS = ["hwp", "hwpx"] as const;
const DOC_EXTENSIONS = ["doc", "docx"] as const;
const PPT_EXTENSIONS = ["ppt", "pptx"] as const;
const MARKDOWN_EXTENSIONS = ["md"] as const;

export function getExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ext;
}

export function isAllowedExtension(ext: string): ext is AllowedExtension {
  return ALLOWED_EXTENSIONS.includes(ext as AllowedExtension);
}

export function isHwpExtension(ext: string): boolean {
  return HWP_EXTENSIONS.includes(ext as (typeof HWP_EXTENSIONS)[number]);
}

export function isDocExtension(ext: string): boolean {
  return DOC_EXTENSIONS.includes(ext as (typeof DOC_EXTENSIONS)[number]);
}

export function isMarkdownExtension(ext: string): boolean {
  return MARKDOWN_EXTENSIONS.includes(ext as (typeof MARKDOWN_EXTENSIONS)[number]);
}

export function isPptExtension(ext: string): boolean {
  return PPT_EXTENSIONS.includes(ext as (typeof PPT_EXTENSIONS)[number]);
}

export type JobStatusForUpload = "QUEUED" | "CONVERTING" | "ACTION_REQUIRED";

export function getStatusForExtension(ext: string): JobStatusForUpload {
  if (isHwpExtension(ext)) return "ACTION_REQUIRED";
  if (isDocExtension(ext) || isPptExtension(ext)) return "CONVERTING";
  return "QUEUED";
}

export const ACTION_REQUIRED_MESSAGE =
  "HWP/HWPX files must be converted to PDF before processing. Please upload a PDF replacement.";
export const DOC_CONVERTING_MESSAGE =
  "DOC/DOCX will be converted to PDF";
export const PPT_CONVERTING_MESSAGE =
  "PPT/PPTX will be extracted for chunking";

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
