import type { RequirementsOrchestrationStageV1 } from "@/lib/requirements/requirementsStateJson";

export function buildInitialProductDefinitionOrchestrationStage(nowIso?: string): RequirementsOrchestrationStageV1 {
  const now = nowIso ?? new Date().toISOString();
  return {
    currentStage: "PRODUCT_DEFINITION",
    completedStages: [],
    updatedAt: now,
  };
}

export function buildProductDefinitionCompletedOrchestrationStage(nowIso?: string): RequirementsOrchestrationStageV1 {
  const now = nowIso ?? new Date().toISOString();
  return {
    currentStage: "IDEATION",
    completedStages: ["PRODUCT_DEFINITION"],
    updatedAt: now,
  };
}

export function isProductDefinitionOrchestrationStage(
  stage: RequirementsOrchestrationStageV1 | null | undefined,
): boolean {
  return stage?.currentStage === "PRODUCT_DEFINITION";
}
