import type { KnowledgePackAgent } from "@/lib/knowledge-packs/types";

const VALID_AGENT_IDS = new Set<string>([
  "AI_DEVELOPER",
  "AI_PLANNER",
  "AI_ANALYST",
  "AI_ARCHITECT",
  "AI_DESIGNER",
  "AI_REVIEWER",
  "AI_SECURITY",
]);

/** 초안 생성·검증용: 알려진 Agent id만 유지하고, 없으면 AI_DEVELOPER. */
export function parseKnowledgePackAgentsForDraft(agentsText: string): KnowledgePackAgent[] {
  const out: KnowledgePackAgent[] = [];
  for (const line of agentsText.split(/\r?\n/)) {
    const s = line.trim();
    if (VALID_AGENT_IDS.has(s)) out.push(s as KnowledgePackAgent);
  }
  return out.length ? out : ["AI_DEVELOPER"];
}

/** 라이선스 힌트 텍스트로 등록 폼의 licenseType select 값을 추정한다. */
export function inferLicenseTypeFromHint(hint: string): string | null {
  const h = hint.trim().toLowerCase();
  if (!h) return null;
  if (/\bmit\b/.test(h) || h.includes("오픈소스 라이선스")) return "MIT";
  if (h.includes("external") || h.includes("외부 서비스") || h.includes("oauth") || h.includes("saas")) return "EXTERNAL_SERVICE";
  if (h.includes("commercial") || h.includes("상용")) return "COMMERCIAL";
  if (h.includes("partner") || h.includes("파트너")) return "PARTNER_LICENSE";
  if (h.includes("open source") || h.includes("오픈소스")) return "OPEN_SOURCE";
  if (h.includes("user") && h.includes("license")) return "USER_PROVIDED_LICENSE";
  return null;
}
