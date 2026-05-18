/**
 * H9.5 — **자원 압력·심각도** 평가(read-only). H9 `buildResourcePressureSummary`와 Overlay 규모 신호를 합친다.
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildResourcePressureSummary } from "@/lib/harness/resourceOrchestration/resourcePressureSummary";
import type { ResourcePressureSummary } from "@/lib/harness/resourceOrchestration/resourceOrchestrationTypes";
import type { ResourcePressureSeverity } from "./resourceStabilizationPolicy";
import {
  RESOURCE_PRESSURE_SEVERITY_ELEVATED_MAX,
  RESOURCE_PRESSURE_SEVERITY_HIGH_MAX,
  RESOURCE_PRESSURE_SEVERITY_STABLE_MAX,
} from "./resourceStabilizationPolicy";

function countWarnings(extract: ExtractedOverlayPromptTraceMetadata | null | undefined): number {
  if (!extract) return 0;
  const pol = extract.overlayPolicyWarnings?.length ?? 0;
  const drift = extract.overlayPolicyDriftWarnings?.length ?? 0;
  const conflict = extract.overlayConflictWarnings?.length ?? 0;
  return pol + drift + conflict;
}

/** Harness·Overlay 관련 섹션으로 카운트될 블록 수(과밀 휴리스틱). */
export function countOverlayHarnessPlanningBlocks(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): number {
  if (!extract) return 0;
  let n = 0;
  if (extract.overlayContextBudget) n += 1;
  if ((extract.overlaySelectedContextRefs?.length ?? 0) > 0 || (extract.overlayPrioritizedContextRefs?.length ?? 0) > 0)
    n += 1;
  if ((extract.overlayContextAssemblyPlan?.length ?? 0) > 0) n += 1;
  if ((extract.overlayPruningCandidates?.length ?? 0) > 0) n += 1;
  if (extract.harnessPromptAssemblyPreview && extract.harnessPromptAssemblyPreview.sections.length > 0) n += 1;
  if (extract.knowledgeActivationPlan && ((extract.knowledgeActivationPlan.items?.length ?? 0) > 0)) n += 1;
  if (extract.memoryRuntimePlan && ((extract.memoryRuntimePlan.references?.length ?? 0) > 0)) n += 1;
  if (extract.executionRoutingPlan && ((extract.executionRoutingPlan.items?.length ?? 0) > 0)) n += 1;
  if (extract.reviewSecurityHarnessPlan && ((extract.reviewSecurityHarnessPlan.checklist?.length ?? 0) > 0)) n += 1;
  if (
    extract.reviewSecurityIssuePlanningReport &&
    ((extract.reviewSecurityIssuePlanningReport.issues?.length ?? 0) > 0)
  )
    n += 1;
  if (extract.remediationLoopPlan && ((extract.remediationLoopPlan.steps?.length ?? 0) > 0)) n += 1;
  return n;
}

function countReviewItems(extract: ExtractedOverlayPromptTraceMetadata | null | undefined): number {
  const sec = extract?.reviewSecurityHarnessPlan?.checklist?.length ?? 0;
  const iss = extract?.reviewSecurityIssuePlanningReport?.issues?.length ?? 0;
  return sec + iss;
}

function countRoutingItems(extract: ExtractedOverlayPromptTraceMetadata | null | undefined): number {
  return extract?.executionRoutingPlan?.items?.length ?? 0;
}

function countMemoryRefs(extract: ExtractedOverlayPromptTraceMetadata | null | undefined): number {
  return extract?.memoryRuntimePlan?.references?.length ?? 0;
}

function countExplainabilitySignals(extract: ExtractedOverlayPromptTraceMetadata | null | undefined): number {
  /** Explainability VM이 없을 때 proxy: 지식 계획 findings + policy warnings. */
  const findings = extract?.knowledgeActivationPlan?.findings?.length ?? 0;
  return findings + Math.min(3, countWarnings(extract));
}

function severityFromComposite(score: number): ResourcePressureSeverity {
  if (score <= RESOURCE_PRESSURE_SEVERITY_STABLE_MAX) return "stable";
  if (score <= RESOURCE_PRESSURE_SEVERITY_ELEVATED_MAX) return "elevated";
  if (score <= RESOURCE_PRESSURE_SEVERITY_HIGH_MAX) return "high";
  return "critical";
}

export type ResourcePressureEvaluation = Readonly<{
  h9Pressure: ResourcePressureSummary;
  pressureSeverity: ResourcePressureSeverity;
  compositeScore: number;
  overlaySectionCount: number;
  warningCount: number;
  explainabilitySignalCount: number;
  reviewItemCount: number;
  routingItemCount: number;
  memoryRefCount: number;
  contributingFactors: readonly string[];
}>;

export function evaluateResourcePressure(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): ResourcePressureEvaluation {
  const h9 = buildResourcePressureSummary(extract ?? null);
  const overlaySectionCount = countOverlayHarnessPlanningBlocks(extract);
  const warningCount = countWarnings(extract);
  const explainabilitySignalCount = countExplainabilitySignals(extract);
  const reviewItemCount = countReviewItems(extract);
  const routingItemCount = countRoutingItems(extract);
  const memoryRefCount = countMemoryRefs(extract);

  const compositeScore = Math.min(
    120,
    h9.score +
      overlaySectionCount * 5 +
      warningCount * 4 +
      explainabilitySignalCount * 2 +
      Math.min(16, reviewItemCount * 2) +
      Math.min(12, routingItemCount * 2) +
      Math.min(12, memoryRefCount * 2)
  );

  const pressureSeverity = severityFromComposite(compositeScore);
  const contributingFactors: string[] = [
    `H9 압력 점수 ${h9.score} (${h9.level})`,
    `가시 planning 블록 약 ${overlaySectionCount}개`,
    `경고·드리프트·충돌 합산 ${warningCount}건`,
    `리뷰/이슈 항목 ${reviewItemCount}건`,
    `실행 라우팅 항목 ${routingItemCount}건`,
    `메모리 참조 ${memoryRefCount}건`,
  ];

  return {
    h9Pressure: h9,
    pressureSeverity,
    compositeScore,
    overlaySectionCount,
    warningCount,
    explainabilitySignalCount,
    reviewItemCount,
    routingItemCount,
    memoryRefCount,
    contributingFactors,
  };
}

/** 진단 API용 직렬화(추가 필드 전용, breaking change 없음). */
export function summarizeResourcePressureForDiagnostic(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): Readonly<Record<string, unknown>> {
  const ev = evaluateResourcePressure(extract);
  return {
    pressureSeverity: ev.pressureSeverity,
    compositeScore: ev.compositeScore,
    h9PressureLevel: ev.h9Pressure.level,
    h9PressureScore: ev.h9Pressure.score,
    overlaySectionCount: ev.overlaySectionCount,
    warningCount: ev.warningCount,
    explainabilitySignalCount: ev.explainabilitySignalCount,
    reviewItemCount: ev.reviewItemCount,
    routingItemCount: ev.routingItemCount,
    memoryRefCount: ev.memoryRefCount,
    contributingFactors: [...ev.contributingFactors],
    h9Factors: [...ev.h9Pressure.factors],
  };
}
