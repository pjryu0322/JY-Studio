import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { assertOfficeOpenXmlPackage } from "../lib/docling-import/office-openxml-validator.ts";
import { isDoclingImportError } from "../lib/docling-import/docling-import-errors.ts";

async function buildZip(entries: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content);
  }
  const buf = await zip.generateAsync({ type: "uint8array" });
  return buf;
}

describe("office-openxml-validator", () => {
  it("accepts minimal DOCX package", async () => {
    const bytes = await buildZip({
      "[Content_Types].xml": "<Types/>",
      "_rels/.rels": "<Relationships/>",
      "word/document.xml": "<w:document/>",
    });
    await assertOfficeOpenXmlPackage(bytes, "DOCX");
  });

  it("rejects ZIP without OOXML required entries", async () => {
    const bytes = await buildZip({ "readme.txt": "hi" });
    await assert.rejects(
      () => assertOfficeOpenXmlPackage(bytes, "DOCX"),
      (e) => isDoclingImportError(e) && e.code === "DOCLING_OFFICE_REQUIRED_ENTRY_MISSING",
    );
  });

  it("rejects PPTX missing presentation.xml", async () => {
    const bytes = await buildZip({
      "[Content_Types].xml": "<Types/>",
      "_rels/.rels": "<Relationships/>",
    });
    await assert.rejects(
      () => assertOfficeOpenXmlPackage(bytes, "PPTX"),
      (e) => isDoclingImportError(e) && e.code === "DOCLING_OFFICE_REQUIRED_ENTRY_MISSING",
    );
  });

  it("accepts XLSX with workbook.xml", async () => {
    const bytes = await buildZip({
      "[Content_Types].xml": "<Types/>",
      "_rels/.rels": "<Relationships/>",
      "xl/workbook.xml": "<workbook/>",
    });
    await assertOfficeOpenXmlPackage(bytes, "XLSX");
  });
});
