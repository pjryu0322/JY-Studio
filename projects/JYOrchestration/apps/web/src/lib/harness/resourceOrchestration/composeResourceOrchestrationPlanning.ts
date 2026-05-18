/**
 * H9 — Resource orchestration planning **단일 조합**(Overlay 진단·UI 공통 입력).
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildRoleResourcePlan } from "./buildRoleResourcePlan";
import { recommendContextBudgetPolicy } from "./recommendContextBudgetPolicy";
import { buildResourcePressureSummary } from "./resourcePressureSummary";
import type { ResourceOrchestrationPlanningCore } from "./resourceOrchestrationTypes";

/** UI·진단 공통: 이 추출만으로 H9 블록에 의미 있는 신호가 있는지. */
export function hasResourceOrchestrationPlanningOverlaySignals(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): boolean {
  if (!extract) return false;
  const rk =
    extract.overlayIdentity?.roleKey != null ? String(extract.overlayIdentity.roleKey).trim() : "";
  return (
    rk.length > 0 ||
    !!extract.overlayContextBudget ||
    (extract.overlayContextAssemblyPlan?.length ?? 0) > 0 ||
    (extract.overlaySelectedContextRefs?.length ?? 0) > 0
  );
}

export function composeResourceOrchestrationPlanning(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): ResourceOrchestrationPlanningCore {
  const roleKey = extract?.overlayIdentity?.roleKey != null ? String(extract.overlayIdentity.roleKey).trim() : "";
  const rk = roleKey.length ? roleKey : null;
  const plan = buildRoleResourcePlan({ roleKey: rk });
  const pressure = buildResourcePressureSummary(extract ?? null);
  const recommendation = recommendContextBudgetPolicy({
    budget: extract?.overlayContextBudget,
    pressure,
  });
  return { roleKey: rk, plan, pressure, recommendation };
}
