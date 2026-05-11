import {
  KNOWLEDGE_PACK_AGENT_LABEL,
  KNOWLEDGE_PACK_CATEGORY_LABEL,
} from "@/lib/knowledge-packs/developerGridPacks";
import { formatKnowledgePackLicenseType } from "@/lib/knowledge-packs/knowledgePackFormat";
import type { KnowledgePack } from "@/lib/knowledge-packs/types";

function flatLine(s: string): string {
  return String(s ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bulletsMd(items: readonly string[]): string {
  if (!items.length) return "_없음_\n\n";
  return `${items.map((item) => `- ${flatLine(item)}`).join("\n")}\n\n`;
}

/**
 * 지식팩 전체 텍스트를 Markdown 문서로 직렬화한다(미리보기 Mock UI 제외).
 */
export function knowledgePackToMarkdown(pack: KnowledgePack): string {
  const agents = pack.agents.map((a) => KNOWLEDGE_PACK_AGENT_LABEL[a]).join(", ");
  const category = KNOWLEDGE_PACK_CATEGORY_LABEL[pack.category];

  const refs =
    pack.references.length > 0
      ? `${pack.references.map((r) => `- [${flatLine(r.label)}](${r.url})`).join("\n")}\n\n`
      : "_없음_\n\n";

  return `# ${flatLine(pack.name)}

- **ID:** \`${pack.id}\`
- **버전:** ${flatLine(pack.version)}
- **범위:** ${pack.scope}
- **카테고리:** ${category}
- **Agent:** ${agents}
- **상태:** ${pack.status}

## 요약

${flatLine(pack.summary)}

## 적용 권장 상황

${bulletsMd(pack.recommendedUseCases)}## 적용 비권장 상황

${bulletsMd(pack.notRecommendedUseCases)}## 라이선스

**유형:** ${formatKnowledgePackLicenseType(pack.license.type)}

### 라이선스 메모

${bulletsMd(pack.license.notes)}## 추가 제약

${bulletsMd(pack.constraints)}## 주요 기능

${bulletsMd(pack.capabilities)}## 대체 / 비교 기준

${bulletsMd(pack.alternatives)}## 참고 링크

${refs}## 구현 지침

${bulletsMd(pack.implementationGuidelines)}## Cursor 반영

${bulletsMd(pack.cursorPromptRules)}## 금지사항

${bulletsMd(pack.forbiddenPatterns)}## 검수 체크리스트

${bulletsMd(pack.reviewChecklist)}---
_보낸 시각(UTC): ${new Date().toISOString()}_
`;
}

function safeFilenameBase(name: string, version: string): string {
  const raw = `${name}-${version}`.trim() || "knowledge-pack";
  return raw
    .replace(/[/\\?*:|"<>#{}[\]`~]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

/** 브라우저에서 \`.md\` 파일로 저장한다. */
export function downloadKnowledgePackMarkdownFile(pack: KnowledgePack): void {
  if (typeof window === "undefined") return;
  const md = knowledgePackToMarkdown(pack);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFilenameBase(pack.name, pack.version)}.md`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
