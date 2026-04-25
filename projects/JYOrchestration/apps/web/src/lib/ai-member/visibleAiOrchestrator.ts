export type VisibleStageKey = "ideation" | "service-flow" | "features" | "tasks" | "prototype";

export const showInternalAgents: boolean = String(process.env.NEXT_PUBLIC_SHOW_INTERNAL_AGENTS ?? "").trim() === "true";

export function displayedAiOrchestrator(): { name: "AI 기획자" } {
  return { name: "AI 기획자" as const };
}

export function displayedAiStatusForStage(stage: VisibleStageKey): string {
  switch (stage) {
    case "ideation":
      return "기획 정리 중";
    case "service-flow":
      return "서비스 흐름 설계 중";
    case "features":
      return "기능 구조화 중";
    case "tasks":
      return "실행 계획 작성 중";
    case "prototype":
      return "프로토타입 생성 중";
    default: {
      const _exhaustive: never = stage;
      return String(_exhaustive);
    }
  }
}

export function visibleStageFromRequirementsStage(stage: string | null | undefined): VisibleStageKey {
  const s = String(stage ?? "").trim();
  if (s === "service-flow") return "service-flow";
  if (s === "features") return "features";
  if (s === "tasks") return "tasks";
  if (s === "prototype" || s === "prototyping" || s === "builder") return "prototype";
  return "ideation";
}

