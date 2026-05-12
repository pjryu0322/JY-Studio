import { getKnowledgePackById } from "@/lib/knowledge-packs/developerKnowledgePacks";

function bulletBlock(title: string, lines: readonly string[]): string {
  const xs = lines.map((s) => String(s ?? "").trim()).filter(Boolean);
  if (!xs.length) return "";
  return [`**${title}**`, ...xs.map((x) => `- ${x}`)].join("\n");
}

/**
 * 정적 seed 지식팩을 RAG 청크 없이도 프롬프트에 넣을 수 있도록 Markdown 본문으로 직렬화한다.
 */
export function buildStaticKnowledgePackPromptContext(packId: string): string {
  const p = getKnowledgePackById(packId.trim());
  if (!p) return "";

  const parts: string[] = [];
  parts.push(`**이름:** ${p.name}`);
  parts.push(`**카테고리:** ${p.category}`);
  if (p.vendor?.trim()) parts.push(`**벤더:** ${p.vendor.trim()}`);
  parts.push("", `**요약**`, p.summary.trim());

  const ig = bulletBlock("구현 지침", p.implementationGuidelines);
  if (ig) parts.push("", ig);
  const cr = bulletBlock("Cursor 기준", p.cursorPromptRules);
  if (cr) parts.push("", cr);
  const fp = bulletBlock("금지 패턴", p.forbiddenPatterns);
  if (fp) parts.push("", fp);
  const rc = bulletBlock("검수 체크리스트", p.reviewChecklist);
  if (rc) parts.push("", rc);
  const sc = bulletBlock("보안 체크리스트", p.securityChecklist ?? []);
  if (sc) parts.push("", sc);

  if (p.references?.length) {
    parts.push("", "**참고 링크**");
    for (const ref of p.references) {
      const label = String(ref.label ?? "").trim();
      const url = String(ref.url ?? "").trim();
      if (label && url) parts.push(`- ${label}: ${url}`);
    }
  }

  return parts.join("\n").trim();
}
