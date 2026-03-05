export interface PptExtractResult {
  text: string;
  message: string;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function sanitizeLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function stripXmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, " ");
}

function isXmlNoiseLine(text: string): boolean {
  const s = text.trim();
  if (!s) return true;
  if (/<[^>]+>/.test(s)) return true;
  if (/(^|[\s<])(?:a|p|r|mc|cp):[a-z][a-z0-9]*/i.test(s)) return true;
  if (/xmlns|Content_Types|tableStyleId|spPr|rPr|endParaRPr/i.test(s)) return true;
  return false;
}

function cleanExtractedLines(lines: string[]): string[] {
  return lines
    .map((line) => sanitizeLine(stripXmlTags(decodeXmlEntities(line))))
    .filter((line) => line.length >= 2)
    .filter((line) => !isXmlNoiseLine(line))
    .filter((line) => {
      const alphaNum = (line.match(/[A-Za-z0-9가-힣]/g) ?? []).length;
      return alphaNum >= Math.max(2, Math.floor(line.length * 0.3));
    });
}

function extractTextRuns(xml: string): string[] {
  const out: string[] = [];
  const rx = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
  let m = rx.exec(xml);
  while (m) {
    out.push(m[1] ?? "");
    m = rx.exec(xml);
  }
  return out;
}

function extractTableBlocks(xml: string): string[] {
  return xml.match(/<a:tbl[\s\S]*?<\/a:tbl>/g) ?? [];
}

function parseTableRows(tableXml: string): string[][] {
  const rowsXml = tableXml.match(/<a:tr[\s\S]*?<\/a:tr>/g) ?? [];
  const rows: string[][] = [];
  for (const rowXml of rowsXml) {
    const cellsXml = rowXml.match(/<a:tc[\s\S]*?<\/a:tc>/g) ?? [];
    const cells: string[] = [];
    for (const cellXml of cellsXml) {
      const runs = extractTextRuns(cellXml);
      const value = sanitizeLine(stripXmlTags(decodeXmlEntities(runs.join(" "))));
      cells.push(value);
    }
    if (cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }
  return rows;
}

function buildTableSemanticText(
  rows: string[][],
  slideIndex: number,
  tableIndex: number
): string {
  if (rows.length === 0) return "";
  const header =
    rows.length >= 2 && rows[0].some((v) => v.length > 0)
      ? rows[0]
      : rows[0].map((_, i) => `col${i + 1}`);
  const dataRows = rows.length >= 2 ? rows.slice(1) : rows;

  const tableLines: string[] = [];
  tableLines.push(`[TABLE s${slideIndex}t${tableIndex}]`);
  tableLines.push(header.join(" | "));
  for (const row of dataRows) {
    tableLines.push(row.join(" | "));
  }

  const semanticLines: string[] = [];
  for (const row of dataRows) {
    const kv = header
      .map((h, i) => {
        const v = row[i] ?? "";
        return v ? `${h}=${v}` : "";
      })
      .filter(Boolean);
    if (kv.length > 0) {
      semanticLines.push(`행 의미: ${kv.join(", ")}`);
    }
  }

  return [...tableLines, ...semanticLines].join("\n").trim();
}

async function extractPptxText(file: File): Promise<PptExtractResult> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(Buffer.from(await file.arrayBuffer()));
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const na = Number(a.match(/slide(\d+)\.xml/i)?.[1] ?? "0");
        const nb = Number(b.match(/slide(\d+)\.xml/i)?.[1] ?? "0");
        return na - nb;
      });

    const chunks: string[] = [];
    for (const slidePath of slideFiles) {
      const xml = await zip.file(slidePath)?.async("string");
      if (!xml) continue;
      const texts = extractTextRuns(xml);
      const cleanedTexts = cleanExtractedLines(texts);
      const slideNo = Number(slidePath.match(/slide(\d+)\.xml/i)?.[1] ?? "0");
      const tableSections = extractTableBlocks(xml)
        .map((tableXml, i) => buildTableSemanticText(parseTableRows(tableXml), slideNo, i + 1))
        .filter(Boolean);
      if (cleanedTexts.length > 0) {
        const body = [
          `Slide ${slideNo}`,
          cleanedTexts.join("\n"),
          tableSections.length > 0 ? `\n${tableSections.join("\n\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n")
          .trim();
        chunks.push(body);
      }
    }

    const text = chunks.join("\n\n").trim();
    return {
      text,
      message:
        text.length > 0
          ? "PPTX processed directly for chunking."
          : "PPTX processed, but no text was detected in slides.",
    };
  } catch (error) {
    return {
      text: "",
      message:
        error instanceof Error
          ? `PPTX extraction failed: ${error.message}`
          : "PPTX extraction failed.",
    };
  }
}

function extractPptBinaryHeuristic(buffer: Buffer): string {
  const out: string[] = [];
  let utf16 = "";
  for (let i = 0; i < buffer.length - 1; i += 2) {
    const lo = buffer[i];
    const hi = buffer[i + 1];
    if (hi === 0 && lo >= 32 && lo <= 126) {
      utf16 += String.fromCharCode(lo);
    } else if (hi === 0 && lo >= 0xac && lo <= 0xd7) {
      utf16 += String.fromCharCode(lo);
    } else {
      if (utf16.length >= 5) out.push(utf16);
      utf16 = "";
    }
  }
  if (utf16.length >= 5) out.push(utf16);

  const latin = buffer.toString("latin1");
  const asciiCandidates = latin.match(/[A-Za-z가-힣0-9][A-Za-z가-힣0-9 .,:;()/_\-]{5,}/g) ?? [];
  const merged = [...out, ...asciiCandidates]
    .map((s) => sanitizeLine(stripXmlTags(s)))
    .filter((s) => s.length >= 6 && !isXmlNoiseLine(s))
    .slice(0, 1200);
  return Array.from(new Set(cleanExtractedLines(merged))).join("\n");
}

export async function extractPptText(file: File, ext: string): Promise<PptExtractResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const isZipContainer = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK"

  if (ext === "pptx" || isZipContainer) {
    return extractPptxText(file);
  }

  try {
    const text = extractPptBinaryHeuristic(buffer).trim();
    return {
      text,
      message:
        text.length > 0
          ? "PPT processed with heuristic extraction."
          : "PPT extraction is limited. Text may be incomplete.",
    };
  } catch (error) {
    return {
      text: "",
      message:
        error instanceof Error
          ? `PPT extraction failed: ${error.message}`
          : "PPT extraction failed.",
    };
  }
}

