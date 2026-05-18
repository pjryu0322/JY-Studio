/**
 * H9 — Overlay **자원 오케스트레이션 계획** UI ViewModel(read-only).
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import {
  composeResourceOrchestrationPlanning,
  hasResourceOrchestrationPlanningOverlaySignals,
} from "@/lib/harness/resourceOrchestration/composeResourceOrchestrationPlanning";
import type { ResourceOrchestrationStance } from "@/lib/harness/resourceOrchestration/resourceOrchestrationTypes";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";
import { overlayUiBudgetPolicyLabel } from "@/lib/overlay-ui/overlayUiLabel";

function stanceLabel(s: ResourceOrchestrationStance): string {
  if (s === "minimal") return "최소";
  if (s === "expanded") return "확장";
  return "균형";
}

function pressureTone(level: "low" | "medium" | "high"): OverlayUiBadgeTone {
  if (level === "high") return "danger";
  if (level === "medium") return "warning";
  return "positive";
}

function pressureLabel(level: "low" | "medium" | "high"): string {
  if (level === "high") return "높음";
  if (level === "medium") return "중간";
  return "낮음";
}

export type OverlayResourceOrchestrationSectionVM = Readonly<{
  hasData: boolean;
  sectionDisclaimer: string;
  roleDisplay: string | null;
  providerPlanLabel: string;
  retrievalStanceLabel: string;
  memoryStanceLabel: string;
  knowledgeStanceLabel: string;
  concurrencyHint: string;
  pressureLevel: "low" | "medium" | "high";
  pressureScore: number;
  pressureLevelLabel: string;
  pressureTone: OverlayUiBadgeTone;
  pressureFactors: readonly string[];
  currentBudgetPolicyLabel: string;
  recommendedBudgetPolicyLabel: string;
  budgetPolicyAligned: boolean;
  budgetRecommendationRationale: string;
}>;

export function buildOverlayResourceOrchestrationSectionVm(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): OverlayResourceOrchestrationSectionVM {
  const core = composeResourceOrchestrationPlanning(extract);
  const hasData = hasResourceOrchestrationPlanningOverlaySignals(extract);

  const roleDisplay =
    core.plan.resolvedContractRoleKey != null
      ? `${core.plan.resolvedContractRoleKey}${core.plan.rawRoleKey && core.plan.rawRoleKey !== core.plan.resolvedContractRoleKey ? ` (원본: ${core.plan.rawRoleKey})` : ""}`
      : core.plan.rawRoleKey;

  return {
    hasData,
    sectionDisclaimer: core.plan.planningDisclaimer,
    roleDisplay: roleDisplay?.length ? roleDisplay : null,
    providerPlanLabel: core.plan.providerPlanLabel,
    retrievalStanceLabel: stanceLabel(core.plan.retrievalStance),
    memoryStanceLabel: stanceLabel(core.plan.memoryStance),
    knowledgeStanceLabel: stanceLabel(core.plan.knowledgeStance),
    concurrencyHint: core.plan.orchestrationConcurrencyHint,
    pressureLevel: core.pressure.level,
    pressureScore: core.pressure.score,
    pressureLevelLabel: pressureLabel(core.pressure.level),
    pressureTone: pressureTone(core.pressure.level),
    pressureFactors: core.pressure.factors,
    currentBudgetPolicyLabel: overlayUiBudgetPolicyLabel(core.recommendation.currentPolicy),
    recommendedBudgetPolicyLabel: overlayUiBudgetPolicyLabel(core.recommendation.recommendedPolicy),
    budgetPolicyAligned: core.recommendation.aligned,
    budgetRecommendationRationale: core.recommendation.rationale,
  };
}
