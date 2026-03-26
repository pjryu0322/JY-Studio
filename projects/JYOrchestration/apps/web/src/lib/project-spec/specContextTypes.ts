/** API·OpenAI 공통: Project Spec 컨텍스트 초안 구조 */
export type SpecContextGenerateResult = {
  coreGoals: string;
  inScope: string[];
  outOfScope: string[];
  targetUsers: string[];
  successCriteria: string[];
};

export function formatListFieldAsBullets(items: string[]): string {
  return items
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .map((line) => {
      const t = line.replace(/^\s*[-*•]\s*/, "").trim();
      return t ? `- ${t}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function normalizeSpecContextFromUnknown(raw: unknown): SpecContextGenerateResult | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;

  const coreGoals = typeof o.coreGoals === "string" ? o.coreGoals.trim() : "";
  const toLines = (v: unknown): string[] => {
    if (Array.isArray(v)) {
      return v.map((x) => String(x ?? "").trim()).filter(Boolean);
    }
    if (typeof v === "string" && v.trim()) {
      return v
        .split(/\n+/)
        .map((s) => s.replace(/^\s*[-*•]\s*/, "").trim())
        .filter(Boolean);
    }
    return [];
  };

  const inScope = toLines(o.inScope);
  const outOfScope = toLines(o.outOfScope);
  const targetUsers = toLines(o.targetUsers);
  const successCriteria = toLines(o.successCriteria);

  if (!coreGoals || inScope.length === 0 || outOfScope.length === 0 || targetUsers.length === 0 || successCriteria.length === 0) {
    return null;
  }

  return { coreGoals, inScope, outOfScope, targetUsers, successCriteria };
}
