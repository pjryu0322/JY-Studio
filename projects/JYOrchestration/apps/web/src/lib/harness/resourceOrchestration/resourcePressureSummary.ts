/**
 * H9 — Overlay 기반 **자원 압력** 요약(휴리스틱, read-only).
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { ResourcePressureLevel, ResourcePressureSummary } from "./resourceOrchestrationTypes";

function overflowWeight(risk: string | null | undefined): number {
  if (risk === "high") return 62;
  if (risk === "medium") return 24;
  if (risk === "low") return 8;
  return 0;
}

function clamp(n: number, max: number): number {
  return Math.min(max, Math.max(0, n));
}

export function buildResourcePressureSummary(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): ResourcePressureSummary {
  const factors: string[] = [];
  let score = 0;

  const budget = extract?.overlayContextBudget;
  const risk = budget?.overflowRisk;
  const ow = overflowWeight(risk);
  if (ow > 0) {
    score += ow;
    factors.push(`토큰 예산 과부하 신호: ${risk === "high" ? "높음" : risk === "medium" ? "중간" : "낮음"}`);
  }

  const plan = extract?.overlayContextAssemblyPlan ?? [];
  const assemblyCost = plan.reduce((a, p) => a + (typeof p.estimatedCost === "number" && Number.isFinite(p.estimatedCost) ? Math.max(0, p.estimatedCost) : 0), 0);
  const assemblyW = clamp(Math.floor(assemblyCost / 400), 28);
  if (assemblyW > 0) {
    score += assemblyW;
    factors.push(`조립 계획 추정 비용 합이 큼(합계 ${assemblyCost})`);
  }

  const selected = extract?.overlaySelectedContextRefs?.length ?? 0;
  const prioritized = extract?.overlayPrioritizedContextRefs?.length ?? 0;
  const ctxW = clamp((selected + prioritized) * 3, 18);
  if (ctxW > 0) {
    score += ctxW;
    factors.push(`선택·우선 컨텍스트 항목 수(선택 ${selected}, 우선 ${prioritized})`);
  }

  const memRefs = extract?.memoryRuntimePlan?.references?.length ?? 0;
  const memW = clamp(memRefs * 4, 14);
  if (memW > 0) {
    score += memW;
    factors.push(`메모리 런타임 참조 ${memRefs}건`);
  }

  const knItems = extract?.knowledgeActivationPlan?.items?.length ?? 0;
  const knW = clamp(knItems * 3, 12);
  if (knW > 0) {
    score += knW;
    factors.push(`지식 활성화 항목 ${knItems}건`);
  }

  if (factors.length === 0) {
    factors.push("압력 신호가 거의 없음(기록된 Overlay·Harness planning이 적음)");
  }

  const level: ResourcePressureLevel = score >= 62 ? "high" : score >= 34 ? "medium" : "low";
  return { level, score, factors };
}
