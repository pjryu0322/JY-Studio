import { sanitizeConversationExportBasename } from "@/lib/chat/conversationMarkdown";
import {
  downloadDeliverableMarkdownAsDocFile,
  markdownToWordBodyHtml,
} from "@/lib/requirements/deliverableDocDownload";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { ProjectArtifactHubEntry } from "@/lib/requirements/projectArtifactHub";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveArtifactHubEntryMarkdown(input: {
  readonly entry: ProjectArtifactHubEntry;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
}): string | null {
  const assetId = String(input.entry.assetId ?? "").trim();
  if (!assetId) return null;

  const artifact = (input.projectArtifacts ?? []).find((a) => a.id === assetId);
  if (artifact) {
    const body = String(artifact.content ?? "").trim();
    return body || null;
  }

  const deliverable = (input.deliverableAssets ?? []).find((d) => d.id === assetId);
  if (deliverable) {
    const body = String(deliverable.content ?? "").trim();
    return body || null;
  }

  return null;
}

export function buildArtifactHubExportSections(input: {
  readonly entries: readonly ProjectArtifactHubEntry[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
}): readonly { readonly title: string; readonly markdown: string }[] {
  const sections: { title: string; markdown: string }[] = [];
  for (const entry of input.entries) {
    const markdown = resolveArtifactHubEntryMarkdown({
      entry,
      projectArtifacts: input.projectArtifacts,
      deliverableAssets: input.deliverableAssets,
    });
    if (!markdown) continue;
    sections.push({
      title: String(entry.title ?? "").trim() || "산출물",
      markdown,
    });
  }
  return sections;
}

function buildCombinedWordBodyHtml(sections: readonly { readonly title: string; readonly markdown: string }[]): string {
  return sections
    .map((section, index) => {
      const titleHtml = `<h1>${escapeHtml(section.title)}</h1>`;
      const bodyHtml = markdownToWordBodyHtml(section.markdown);
      const divider = index < sections.length - 1 ? '<hr style="margin:24pt 0;border:none;border-top:1px solid #e2e8f0;" />' : "";
      return `${titleHtml}\n${bodyHtml}\n${divider}`;
    })
    .join("\n");
}

function buildPrintableDocumentHtml(input: {
  readonly documentTitle: string;
  readonly sections: readonly { readonly title: string; readonly markdown: string }[];
}): string {
  const body = buildCombinedWordBodyHtml(input.sections);
  const safeTitle = escapeHtml(input.documentTitle || "산출물");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
@page { margin: 18mm; }
body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; font-size: 11pt; line-height: 1.5; color: #0f172a; }
h1 { font-size: 16pt; margin: 0 0 12pt; page-break-after: avoid; }
h2 { font-size: 13pt; margin: 14pt 0 8pt; }
h3 { font-size: 11pt; margin: 10pt 0 6pt; }
p, li { margin: 0 0 6pt; }
ul { margin: 0 0 8pt 18pt; }
hr { margin: 20pt 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function downloadArtifactHubSelectionAsDoc(input: {
  readonly projectName: string;
  readonly sections: readonly { readonly title: string; readonly markdown: string }[];
}): void {
  if (!input.sections.length || typeof document === "undefined") return;
  const combinedMarkdown = input.sections
    .map((s) => `# ${s.title}\n\n${s.markdown}`)
    .join("\n\n---\n\n");
  const title =
    input.sections.length === 1
      ? input.sections[0]!.title
      : `${String(input.projectName ?? "").trim() || "프로젝트"}_산출물`;
  downloadDeliverableMarkdownAsDocFile({
    title,
    markdown: combinedMarkdown,
  });
}

/** 브라우저 인쇄( PDF로 저장 ) 대화상자 — 별도 PDF 라이브러리 없이보냅니다. */
export function openArtifactHubSelectionAsPdf(input: {
  readonly projectName: string;
  readonly sections: readonly { readonly title: string; readonly markdown: string }[];
}): void {
  if (!input.sections.length || typeof window === "undefined") return;
  const documentTitle = `${String(input.projectName ?? "").trim() || "프로젝트"} 산출물`;
  const html = buildPrintableDocumentHtml({ documentTitle, sections: input.sections });
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    try {
      printWindow.print();
    } catch {
      /* ignore */
    }
  }, 300);
}

export function defaultArtifactHubExportFilenameStem(projectName: string): string {
  return sanitizeConversationExportBasename(String(projectName ?? "").trim() || "프로젝트");
}
