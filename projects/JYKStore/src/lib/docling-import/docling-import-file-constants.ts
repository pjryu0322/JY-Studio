/** Shared Docling file extension lists (safe for browser + server). */

export const DOCLING_SOURCE_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".pptx",
  ".html",
  ".htm",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".tiff",
  ".tif",
] as const;

export const DOCLING_JSON_EXTENSIONS = [".json"] as const;
export const DOCLING_MARKDOWN_EXTENSIONS = [".md"] as const;

export function extensionOfFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}
