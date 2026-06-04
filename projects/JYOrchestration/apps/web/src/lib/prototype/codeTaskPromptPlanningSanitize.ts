const PLATFORM_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["JY Orchestration 템플릿 미리보기와 동일한 IA", "선택된 템플릿 미리보기와 동일한 IA"],
  ["JY Orchestration **템플릿 미리보기와 동일한 IA**", "선택된 템플릿 미리보기와 동일한 IA"],
  ["JY Orchestration 템플릿 미리보기", "선택된 템플릿 미리보기"],
  ["JY Orchestration 미리보기", "선택된 템플릿 미리보기"],
  ["JY Orchestration", ""],
  ["JYOrchestration", ""],
  ["projects/JYOrchestration", ""],
  ["모노레포", ""],
  ["Stage1/Stage2/ENV_TEST", ""],
] as const;

export function sanitizePlanningPromptText(text: string): string {
  let out = String(text ?? "");
  for (const [from, to] of PLATFORM_REPLACEMENTS) {
    if (from && out.includes(from)) {
      out = out.split(from).join(to);
    }
  }
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/\n{4,}/g, "\n\n\n");
  return out.trim();
}

/** 한 줄( bullet 본문)용 — 줄바꿈 구조는 건드리지 않음 */
export function sanitizePlanningPromptLine(text: string): string {
  return sanitizePlanningPromptText(String(text ?? "").replace(/\n/g, " "));
}
