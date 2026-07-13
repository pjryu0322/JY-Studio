import { validateZipAndReadSelectedEntries } from "@/lib/distribution/payload-zip-reader";
import { DoclingImportError } from "@/lib/docling-import/docling-import-errors";

export type OfficeOpenXmlKind = "DOCX" | "PPTX" | "XLSX";

const COMMON_REQUIRED = ["[Content_Types].xml", "_rels/.rels"] as const;

const KIND_REQUIRED: Record<OfficeOpenXmlKind, string> = {
  DOCX: "word/document.xml",
  PPTX: "ppt/presentation.xml",
  XLSX: "xl/workbook.xml",
};

function normalizeEntryName(name: string): string {
  return name.replace(/\\/g, "/").replace(/^\/+/, "");
}

/**
 * Validate OOXML package structure (ZIP + required entries). Read-only.
 */
export async function assertOfficeOpenXmlPackage(
  bytes: Uint8Array,
  kind: OfficeOpenXmlKind,
): Promise<void> {
  const required = [...COMMON_REQUIRED, KIND_REQUIRED[kind]];
  let result;
  try {
    result = await validateZipAndReadSelectedEntries(bytes, required);
  } catch {
    throw new DoclingImportError(
      "DOCLING_OFFICE_PACKAGE_INVALID",
      "Office 문서 패키지를 열 수 없습니다.",
      400,
    );
  }

  if (!result.ok) {
    throw new DoclingImportError(
      "DOCLING_OFFICE_PACKAGE_INVALID",
      "Office 문서 ZIP 패키지가 올바르지 않습니다.",
      400,
    );
  }

  const names = new Set(result.entries.map((e) => normalizeEntryName(e.path)));
  for (const entry of required) {
    if (!names.has(entry)) {
      throw new DoclingImportError(
        "DOCLING_OFFICE_REQUIRED_ENTRY_MISSING",
        `Office 문서에 필수 항목이 없습니다: ${entry}`,
        400,
      );
    }
  }
}
