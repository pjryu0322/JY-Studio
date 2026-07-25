import type { ProviderChunkReviewDetailDto } from "@/lib/provider-pack/provider-chunk-review-detail-service";
import {
  PROVIDER_CHUNK_PDF_EXPORT_MAX,
  type ProviderChunkReviewItem,
} from "@/lib/provider-chunk-review";
import type { jsPDF } from "jspdf";

export { PROVIDER_CHUNK_PDF_EXPORT_MAX };

export type ProviderChunkPdfExportRow = {
  item: ProviderChunkReviewItem;
  detail: ProviderChunkReviewDetailDto | null;
};

const PDF_STYLE = `
  body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; color: #0f172a; margin: 24px; font-size: 12px; line-height: 1.5; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #64748b; margin: 0 0 20px; font-size: 11px; }
  .chunk { padding: 0; }
  h2 { font-size: 14px; margin: 0 0 8px; }
  h3 { font-size: 12px; margin: 12px 0 4px; }
  .meta { margin: 2px 0; }
  pre { white-space: pre-wrap; word-break: break-word; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; font-family: ui-monospace, monospace; font-size: 11px; }
  .ids { color: #64748b; font-size: 10px; margin-top: 8px; }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapHtmlDocument(title: string, bodyInner: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${PDF_STYLE}</style>
</head>
<body>
${bodyInner}
</body>
</html>`;
}

export function buildProviderChunkReviewPdfCoverHtml(input: {
  packName: string;
  exportedAt: string;
  count: number;
}): string {
  return wrapHtmlDocument(
    `${input.packName} - 검색 지식 단위`,
    `<h1>${escapeHtml(input.packName)}</h1>
<p class="sub">검색 지식 단위 검토 내보내기 · ${escapeHtml(input.exportedAt)} · ${input.count}건</p>
<p class="sub">각 지식 단위는 새 페이지에서 시작합니다.</p>`,
  );
}

export function buildProviderChunkReviewPdfChunkHtml(
  row: ProviderChunkPdfExportRow,
  index: number,
): string {
  const location = [
    row.item.sourceFileName,
    ...row.item.sourceSectionPath,
    row.detail?.section,
  ]
    .filter(Boolean)
    .join(" › ");
  const body =
    row.detail?.content?.trim() || row.item.contentPreview || "(본문 없음)";
  const source =
    row.detail?.sourceContentPreview?.trim() || "(저장된 원문 없음)";

  return wrapHtmlDocument(
    `${index + 1}. ${row.item.title}`,
    `<section class="chunk">
  <h2>${index + 1}. ${escapeHtml(row.item.title)}</h2>
  <p class="meta"><strong>상태</strong> ${escapeHtml(row.item.statusLabel)}
    ${row.item.issueTypeLabels.length ? ` · ${escapeHtml(row.item.issueTypeLabels.join(", "))}` : ""}</p>
  <p class="meta"><strong>원본 위치</strong> ${escapeHtml(location || "원본 위치 정보 없음")}</p>
  <p class="meta"><strong>판단 사유</strong> ${escapeHtml(row.item.issueReason)}</p>
  <h3>지식 단위 본문</h3>
  <pre>${escapeHtml(body)}${row.detail?.contentTruncated ? "\n…(이후 생략)" : ""}</pre>
  <h3>원문</h3>
  <pre>${escapeHtml(source)}${row.detail?.sourceContentTruncated ? "\n…(이후 생략)" : ""}</pre>
  <p class="ids">지식 단위 ID: ${escapeHtml(row.item.chunkId)}</p>
</section>`,
  );
}

/** @deprecated Prefer cover + per-chunk builders; kept for tests/compat. */
export function buildProviderChunkReviewPdfHtml(input: {
  packName: string;
  exportedAt: string;
  rows: readonly ProviderChunkPdfExportRow[];
}): string {
  const cover = buildProviderChunkReviewPdfCoverHtml({
    packName: input.packName,
    exportedAt: input.exportedAt,
    count: input.rows.length,
  });
  const chunks = input.rows
    .map((row, idx) => buildProviderChunkReviewPdfChunkHtml(row, idx))
    .join("\n<!-- pagebreak -->\n");
  return `${cover}\n<!-- pagebreak -->\n${chunks}`;
}

async function renderHtmlToCanvas(
  html: string,
  html2canvas: typeof import("html2canvas").default,
): Promise<HTMLCanvasElement> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "794px";
  host.style.background = "#ffffff";
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    return await html2canvas(host, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });
  } finally {
    host.remove();
  }
}

/**
 * Draws a canvas onto the current PDF page and continues onto new pages
 * if the canvas is taller than one page. Does not insert a leading page break.
 */
function appendCanvasWithInternalPageBreaks(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;
  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.92);

  let heightLeft = imgHeight;
  let position = margin;
  let firstSlice = true;

  while (heightLeft > 0) {
    if (!firstSlice) {
      pdf.addPage();
      position = margin - (imgHeight - heightLeft);
    }
    pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;
    firstSlice = false;
  }
}

/**
 * Renders selected chunk review rows to a downloadable PDF.
 * Each knowledge unit starts on a new page (page skip between units).
 */
export async function downloadProviderChunkReviewPdf(input: {
  packName: string;
  fileName: string;
  rows: readonly ProviderChunkPdfExportRow[];
}): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("브라우저에서만 PDF를 저장할 수 있습니다.");
  }
  if (input.rows.length === 0) {
    throw new Error("PDF로 저장할 지식 단위를 선택해 주세요.");
  }
  if (input.rows.length > PROVIDER_CHUNK_PDF_EXPORT_MAX) {
    throw new Error(`한 번에 최대 ${PROVIDER_CHUNK_PDF_EXPORT_MAX}건까지 저장할 수 있습니다.`);
  }

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const exportedAt = new Date().toLocaleString("ko-KR");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const coverCanvas = await renderHtmlToCanvas(
    buildProviderChunkReviewPdfCoverHtml({
      packName: input.packName,
      exportedAt,
      count: input.rows.length,
    }),
    html2canvas,
  );
  appendCanvasWithInternalPageBreaks(pdf, coverCanvas);

  for (let i = 0; i < input.rows.length; i += 1) {
    pdf.addPage();
    const chunkCanvas = await renderHtmlToCanvas(
      buildProviderChunkReviewPdfChunkHtml(input.rows[i]!, i),
      html2canvas,
    );
    appendCanvasWithInternalPageBreaks(pdf, chunkCanvas);
  }

  const safeName = input.fileName.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
  pdf.save(safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`);
}
