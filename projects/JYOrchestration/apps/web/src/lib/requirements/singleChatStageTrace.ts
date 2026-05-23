import type {
  ProjectSingleChatCtaId,
  ProjectSingleChatStageRoutingResult,
} from "@/lib/requirements/singleChatStageRouter";

export type ProjectSingleChatStageRoutingSource =
  | "llm_stage_intent"
  | "direct_cta"
  | "quick_action"
  | "legacy_label"
  | "fallback";

export function inferProjectSingleChatStageRoutingSource(input: {
  readonly directCtaId?: ProjectSingleChatCtaId | string | null;
  readonly directQuickActionId?: string | null;
  readonly routerStageIntent?: string | null;
  readonly usedLegacyLabelMatch?: boolean;
}): ProjectSingleChatStageRoutingSource {
  if (String(input.directCtaId ?? "").trim()) return "direct_cta";
  if (input.usedLegacyLabelMatch) return "legacy_label";
  if (String(input.directQuickActionId ?? "").trim()) return "quick_action";
  const stage = String(input.routerStageIntent ?? "").trim();
  if (
    stage &&
    stage !== "general_advice" &&
    stage !== "service_flow"
  ) {
    return "llm_stage_intent";
  }
  if (stage === "service_flow") return "llm_stage_intent";
  return "fallback";
}

export function formatProjectSingleChatStageRoutingTrace(input: {
  readonly route: ProjectSingleChatStageRoutingResult | null | undefined;
  readonly source?: ProjectSingleChatStageRoutingSource;
  readonly directCtaId?: string | null;
  readonly routerStageIntent?: string | null;
  readonly routerServiceFlowSubIntent?: string | null;
}): string {
  const route = input.route;
  const lines = [
    "[projectSingleChatStageRouter]",
    `stageIntent=${route?.stageIntent ?? ""}`,
    `serviceFlowSubIntent=${route?.serviceFlowSubIntent ?? input.routerServiceFlowSubIntent ?? ""}`,
    `source=${input.source ?? "fallback"}`,
    `directCtaId=${String(input.directCtaId ?? "").trim()}`,
    `routerStageIntent=${String(input.routerStageIntent ?? "").trim()}`,
    `routerServiceFlowSubIntent=${String(input.routerServiceFlowSubIntent ?? "").trim()}`,
    `shouldRunServiceFlowAnalyze=${String(route?.shouldRunServiceFlowAnalyze ?? false)}`,
    `shouldRunOrchestrationTransition=${String(route?.shouldRunOrchestrationTransition ?? false)}`,
    `shouldRunAdviceToFlowApply=${String(route?.shouldRunAdviceToFlowApply ?? false)}`,
    `shouldRunFlowReview=${String(route?.shouldRunFlowReview ?? false)}`,
    `shouldRouteToScreenPlanning=${String(route?.shouldRouteToScreenPlanning ?? false)}`,
    `shouldRouteToFeaturePlanning=${String(route?.shouldRouteToFeaturePlanning ?? false)}`,
    `shouldRouteToGenerationPrepare=${String(route?.shouldRouteToGenerationPrepare ?? false)}`,
    `reason=${route?.reason ?? ""}`,
  ];
  return lines.join("\n");
}

export function formatScreenPlanningPromptTrace(input: {
  readonly mode: "llm" | "fallback";
  readonly status: "success" | "fallback" | "validation_failed";
  readonly issueCodes?: readonly string[];
}): string {
  const issues =
    input.issueCodes?.length ? ` issues=${input.issueCodes.join(",")}` : "";
  return `[screenPlanning]\nmode=${input.mode}\nstatus=${input.status}${issues}`;
}
