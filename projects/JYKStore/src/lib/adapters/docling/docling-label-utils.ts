/**
 * Client-safe Docling label helpers (no Node built-ins).
 */

/** Labels that must never be treated as document headings. */
const NON_HEADING_LABELS = new Set([
  "group",
  "list",
  "picture",
  "table",
  "paragraph",
  "text",
  "list_item",
  "code",
  "caption",
  "footnote",
  "formula",
  "checkbox",
  "page_header",
  "page_footer",
]);

const HEADING_LABEL_RE = /^(section_header|title|heading)$|heading|section_header/;

const BODY_LABEL_RE =
  /^(paragraph|text|list_item|code|caption|footnote|formula)$|paragraph|list_item|footnote|formula/;

const BODY_EXCLUDE_LABELS = new Set([
  "page_header",
  "page_footer",
  "furniture",
  "page_number",
]);

export function isHeadingTextLabel(label: string | null | undefined): boolean {
  const l = (label ?? "").toLowerCase().trim();
  if (!l || NON_HEADING_LABELS.has(l)) return false;
  if (l.includes("list") || l.includes("group") || l.includes("picture") || l.includes("table")) {
    return false;
  }
  return HEADING_LABEL_RE.test(l) || l.includes("title");
}

export function isBodyTextLabel(label: string | null | undefined): boolean {
  const l = (label ?? "").toLowerCase().trim();
  if (!l) return true;
  if (isHeadingTextLabel(l)) return false;
  if (BODY_EXCLUDE_LABELS.has(l)) return false;
  if (l.includes("picture") || l.includes("table") || l === "group") return false;
  return BODY_LABEL_RE.test(l) || l.includes("list");
}
