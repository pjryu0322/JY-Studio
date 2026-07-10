export type KuDraftUserFacingContent = {
  description: string;
  keyPoints: string[];
  exampleCode: string | null;
  relatedUnits: string[];
};

export function buildUserFacingKuDraftContent(params: {
  title: string;
  description: string;
  keyPoints: string[];
  exampleCode?: string | null;
  relatedUnits?: string[];
}): string {
  const related = params.relatedUnits?.filter(Boolean) ?? [];
  const lines = [
    `## 설명`,
    params.description,
    "",
    "## 핵심 내용",
    ...(params.keyPoints.length > 0
      ? params.keyPoints.map((point) => `- ${point}`)
      : ["- 핵심 내용을 검토해 주세요."]),
  ];

  if (params.exampleCode?.trim()) {
    lines.push("", "## 예제 코드", "```", params.exampleCode.trim().slice(0, 1200), "```");
  }

  if (related.length > 0) {
    lines.push("", "## 관련 Unit", ...related.map((unit) => `- ${unit}`));
  }

  return lines.join("\n").slice(0, 4000);
}

export function parseUserFacingKuDraftContent(content: string): KuDraftUserFacingContent {
  const sections = new Map<string, string>();
  const parts = content.split(/^##\s+/m).filter(Boolean);

  for (const part of parts) {
    const [headingLine, ...rest] = part.split("\n");
    const heading = headingLine?.trim().toLowerCase() ?? "";
    const body = rest.join("\n").trim();
    sections.set(heading, body);
  }

  const description =
    sections.get("설명") ??
    sections.get("목적")?.replace(/^이 knowledge unit.*$/im, "").trim() ??
    "AI가 추출한 지식 단위 설명입니다.";

  const keyBlock = sections.get("핵심 내용") ?? "";
  const keyPoints = keyBlock
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  const exampleBlock = sections.get("예제 코드") ?? "";
  const exampleCode = exampleBlock.replace(/^```/gm, "").replace(/```$/gm, "").trim() || null;

  const relatedBlock = sections.get("관련 unit") ?? "";
  const relatedUnits = relatedBlock
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  return {
    description: description.slice(0, 800),
    keyPoints,
    exampleCode,
    relatedUnits,
  };
}

export function buildKuDraftActionableWarnings(input: {
  title: string;
  sourcePath: string | null;
  siblingTitles: string[];
}): string[] {
  const warnings: string[] = [];
  const normalizedTitle = input.title.toLowerCase();

  if (
    normalizedTitle.includes("install") &&
    (normalizedTitle.includes("import") || normalizedTitle.includes("usage"))
  ) {
    warnings.push("주제가 너무 큼 — Install / Import / Usage를 각각 별도 Unit으로 분리하는 것을 권장합니다.");
  }

  const duplicates = input.siblingTitles.filter(
    (other) => other !== input.title && other.toLowerCase().includes(normalizedTitle.slice(0, 8)),
  );
  if (duplicates.length > 0) {
    warnings.push("동일한 Source에서 유사 제목이 감지됨 — 자동 병합을 적용했는지 확인하세요.");
  }

  if (input.sourcePath?.toLowerCase().endsWith("package.json")) {
    warnings.push("메타데이터 파일 기반 Unit — 설치/의존성 설명만 포함되는지 확인하세요.");
  }

  return warnings;
}
