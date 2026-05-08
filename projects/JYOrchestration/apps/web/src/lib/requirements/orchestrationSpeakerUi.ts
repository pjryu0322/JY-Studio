export type OrchestrationOwnerUi = "planner" | "analyst" | "architect" | "designer" | "reviewer" | "security";

export function speakerNameForOwner(owner: OrchestrationOwnerUi): string {
  if (owner === "designer") return "AI 디자이너";
  if (owner === "architect") return "AI 설계자";
  if (owner === "analyst") return "AI 분석가";
  if (owner === "security") return "AI 보안관";
  if (owner === "reviewer") return "AI 리뷰어";
  return "AI 기획자";
}

export function detectOwnerHintFromText(text: string): OrchestrationOwnerUi | null {
  const s = String(text ?? "").trim().toLowerCase();
  if (!s) return null;
  if (/(디자이너|ui|ux)/i.test(s)) return "designer";
  if (/(설계자|아키텍트|개발자\s*관점|architect|실시간|배치|파이프라인|연동)/i.test(s)) return "architect";
  if (/(분석가|도메인\s*전문가|analyst|승인|권한|협업|흐름)/i.test(s)) return "analyst";
  if (/(보안|개인정보|security|감사|보관)/i.test(s)) return "security";
  if (/(리뷰어|reviewer|검토|검수|우선순위|리스크)/i.test(s)) return "reviewer";
  return null;
}

