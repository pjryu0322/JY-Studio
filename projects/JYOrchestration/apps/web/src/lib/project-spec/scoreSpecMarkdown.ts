/**
 * 휴리스틱 Spec 품질 점수(모델 간 상대 비교용). LLM 판정이 아님.
 */
export type SpecQualityScore = {
  /** 0–100 */
  overall: number;
  completeness: number;
  structureQuality: number;
  executionReadiness: number;
};

const SECTION_PATTERNS = [
  /project\s*overview|프로젝트\s*개요/i,
  /scope|범위/i,
  /use\s*cases?|유스케이스/i,
  /functional\s*requirements?|기능\s*요구/i,
  /non-?functional|비기능/i,
  /system\s*architecture|아키텍처/i,
  /constraints?\s*(&|및)\s*assumptions?|제약/i,
];

function clamp01(n: number): number {
  if (Number.isNaN(n)) {
    return 0;
  }
  return Math.max(0, Math.min(1, n));
}

export function scoreSpecMarkdown(md: string): SpecQualityScore {
  const t = md.trim();
  if (!t) {
    return { overall: 0, completeness: 0, structureQuality: 0, executionReadiness: 0 };
  }

  let sectionsHit = 0;
  for (const p of SECTION_PATTERNS) {
    if (p.test(t)) {
      sectionsHit += 1;
    }
  }
  const completeness = clamp01(sectionsHit / SECTION_PATTERNS.length);

  const hasTable = /\|[^\n]+\|/.test(t);
  const hasFrId = /\bFR-\d+/i.test(t);
  const hasUcId = /\bUC-\d+/i.test(t);
  const structureQuality = clamp01(
    (sectionsHit / SECTION_PATTERNS.length) * 0.55 + (hasTable ? 0.2 : 0) + (hasFrId ? 0.125 : 0) + (hasUcId ? 0.125 : 0)
  );

  const acceptance =
    /acceptance|수용\s*기준|검증/i.test(t) && (/\b(P0|P1|P2)\b/.test(t) || /우선순위/i.test(t));
  const nfrBlocks =
    /performance|성능/i.test(t) &&
    /security|보안/i.test(t) &&
    (/scalability|확장/i.test(t) || /availability|가용/i.test(t)) &&
    /(logging|audit|감사|로그)/i.test(t);
  const archBlocks =
    /components?|컴포넌트/i.test(t) && /API|api/i.test(t) && /storage|스토리지|저장/i.test(t);
  const executionReadiness = clamp01(
    (acceptance ? 0.35 : 0) + (nfrBlocks ? 0.35 : 0) + (archBlocks ? 0.3 : 0)
  );

  const overall = Math.round(100 * clamp01(completeness * 0.35 + structureQuality * 0.3 + executionReadiness * 0.35));

  return {
    overall,
    completeness: Math.round(100 * completeness),
    structureQuality: Math.round(100 * structureQuality),
    executionReadiness: Math.round(100 * executionReadiness),
  };
}
