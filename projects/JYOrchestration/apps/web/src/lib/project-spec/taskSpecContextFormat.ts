/**
 * Task 실행 프롬프트에 넣는 ProjectSpec 맥락 텍스트 (업로드 parsedJson 또는 워크스페이스 마크다운).
 */

export function formatSpecContextFromParsedJson(parsedJson: unknown): string {
  if (parsedJson == null || typeof parsedJson !== "object") {
    return "(ProjectSpec 요약 없음 — Task 설명만 따르세요.)";
  }
  const p = parsedJson as Record<string, unknown>;
  const overview = typeof p.projectOverview === "string" ? p.projectOverview.trim() : "";
  const features = Array.isArray(p.mainFeatures)
    ? p.mainFeatures.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
    : [];
  const constraints = Array.isArray(p.constraints)
    ? p.constraints.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
    : [];

  const lines: string[] = [];
  if (overview) {
    lines.push(`- 제품·아이디어 요약: ${overview.slice(0, 800)}`);
  }
  if (features.length > 0) {
    lines.push(`- 기능·문장 목록:\n${features.map((f) => `  - ${f}`).join("\n")}`);
  }
  if (constraints.length > 0) {
    lines.push(`- 제약·주의:\n${constraints.map((c) => `  - ${c}`).join("\n")}`);
  }
  return lines.length > 0 ? lines.join("\n") : "(ProjectSpec 필드가 비어 있습니다.)";
}

export function formatSpecContextFromWorkspaceMarkdown(markdown: string | null | undefined): string {
  const m = markdown?.trim();
  if (!m) {
    return "(워크스페이스 확정 Spec 본문이 비어 있습니다.)";
  }
  const cap = 16_000;
  const body = m.length > cap ? `${m.slice(0, cap)}\n\n[이하 생략]` : m;
  return `## 확정 Project Spec (워크스페이스 마크다운)\n\n${body}`;
}
