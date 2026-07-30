/**
 * Client-side helpers for Admin 사전정리 inventory selection / Excel export.
 */
import JSZip from "jszip";

export type PreflightExportRow = {
  path: string;
  kind: "file" | "folder";
  extension: string;
  sizeBytes: number | null;
  excluded: boolean;
  exclusionReason: string;
  exclusionTargetLabel: string;
};

/** Paths under a folder root (includes the root itself). */
export function collectSubtreePaths(
  entries: readonly { path: string }[],
  rootPath: string,
): string[] {
  const root = rootPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!root) return [];
  const prefix = `${root}/`;
  return entries
    .map((e) => e.path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim())
    .filter((p) => p === root || p.startsWith(prefix));
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sheetCell(ref: string, value: string | number): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(String(value))}</t></is></c>`;
}

function colLetter(index: number): string {
  // 0-based → A, B, ...
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/**
 * Build a minimal .xlsx (OOXML) workbook for 사전정리 inventory export.
 * Uses JSZip only — no extra spreadsheet dependency.
 */
export async function buildPreflightInventoryXlsx(
  rows: readonly PreflightExportRow[],
  options?: { sheetName?: string },
): Promise<Uint8Array> {
  const sheetName = (options?.sheetName ?? "원본인벤토리").slice(0, 31);
  const headers = [
    "경로",
    "종류",
    "확장자",
    "크기(bytes)",
    "제외여부",
    "제외대상(정책)",
    "제외사유",
  ];

  const sheetRows: string[] = [];
  sheetRows.push(
    `<row r="1">${headers.map((h, i) => sheetCell(`${colLetter(i)}1`, h)).join("")}</row>`,
  );
  rows.forEach((row, idx) => {
    const r = idx + 2;
    const values: Array<string | number> = [
      row.path,
      row.kind === "folder" ? "폴더" : "파일",
      row.extension || "",
      row.sizeBytes ?? "",
      row.excluded ? "Y" : "N",
      row.exclusionTargetLabel || "",
      row.exclusionReason || "",
    ];
    sheetRows.push(
      `<row r="${r}">${values.map((v, i) => sheetCell(`${colLetter(i)}${r}`, v)).join("")}</row>`,
    );
  });

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${sheetRows.join("\n    ")}
  </sheetData>
</worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
    Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.folder("_rels")!.file(".rels", rootRels);
  const xl = zip.folder("xl")!;
  xl.file("workbook.xml", workbookXml);
  xl.folder("_rels")!.file("workbook.xml.rels", workbookRels);
  xl.folder("worksheets")!.file("sheet1.xml", sheetXml);

  const out = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return out;
}

export function downloadUint8ArrayFile(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): void {
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: mimeType,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
