/**
 * Overlay: **Policy-guided Context Assembly Preparation Layer**의 핵심 metadata.
 *
 * **이 헬퍼는 prompt 본문을 조립하지 않는다.** 어떤 context가 prompt assembly에 우선
 * 사용되어야 하는지를 추적·계획하기 위한 read-only metadata만 만든다. 실제 assembly,
 * payload, 라우팅 어느 것도 변경하지 않는다.
 */

import type {
  OverlaySelectedContextRef,
  OverlaySelectedContextRefType,
} from "@/lib/overlay/overlayContextSelection";
import type {
  OverlayContextBudgetMetadata,
  OverlayContextBudgetOverflowRisk,
  OverlayContextBudgetPolicy,
} from "@/lib/overlay/overlayContextBudget";

export type OverlayAssemblyPlanItemType = Exclude<OverlaySelectedContextRefType, "role">;

export type OverlayAssemblyPlanItem = Readonly<{
  type: OverlayAssemblyPlanItemType;
  source: string;
  /** 0(최우선) → 큰 값(낮음). 동일 type 내부에서 정렬 가능. */
  priority: number;
  /** 왜 포함되어야 하는지(예: `role_memory_scope`, `role_knowledge_hint`). */
  includeReason: string;
  /** heuristic 비용 단위(소스 길이 등에서 파생). 실제 토큰 측정 아님. */
  estimatedCost: number;
  /** budget overflow 시 우선 줄여야 할 후보 여부. */
  pruningCandidate: boolean;
}>;

const VALID_PLAN_TYPES = new Set<OverlayAssemblyPlanItemType>([
  "memory",
  "knowledge",
  "timeline",
  "workspace",
  "policy",
]);

const SOURCE_MAX_LEN = 240;
const REASON_MAX_LEN = 120;

/** 행당 plan item 상한(타임라인 비대화 방지). */
export const OVERLAY_ASSEMBLY_PLAN_ITEMS_MAX = 32;

/** 우선순위 임계값: plan item이 "high priority"로 간주되는 기준(`priority <= HIGH_PRIORITY_THRESHOLD`). */
export const OVERLAY_ASSEMBLY_PLAN_HIGH_PRIORITY_THRESHOLD = 20;

/** estimatedCost 산출용 기본 비용(휴리스틱). */
const BASE_COST_BY_TYPE: Record<OverlayAssemblyPlanItemType, number> = {
  memory: 40,
  knowledge: 60,
  timeline: 25,
  workspace: 15,
  policy: 10,
};

function pruningCandidateForOverflow(
  type: OverlayAssemblyPlanItemType,
  overflowRisk: OverlayContextBudgetOverflowRisk | null
): boolean {
  if (overflowRisk === "high") return type === "timeline" || type === "workspace" || type === "knowledge";
  if (overflowRisk === "medium") return type === "timeline" || type === "workspace";
  return false;
}

function estimatedCostOf(item: OverlaySelectedContextRef, planType: OverlayAssemblyPlanItemType): number {
  const base = BASE_COST_BY_TYPE[planType];
  const sourceLen = typeof item.source === "string" ? item.source.length : 0;
  return Math.max(1, Math.floor(base + sourceLen / 4));
}

function asPlanType(type: OverlaySelectedContextRefType): OverlayAssemblyPlanItemType | null {
  if (type === "role") return null;
  return VALID_PLAN_TYPES.has(type as OverlayAssemblyPlanItemType)
    ? (type as OverlayAssemblyPlanItemType)
    : null;
}

/**
 * Selection 결과를 받아 **무엇을 prompt assembly에 우선 포함해야 하는가**를 표현하는 plan을 만든다.
 * `role` 타입은 always-include 주체이므로 plan에서는 제외한다.
 */
export function buildOverlayContextAssemblyPlan(input: {
  selectedContextRefs: readonly OverlaySelectedContextRef[];
  budgetMetadata?: OverlayContextBudgetMetadata | null;
}): readonly OverlayAssemblyPlanItem[] {
  const overflowRisk = input.budgetMetadata?.overflowRisk ?? null;
  const out: OverlayAssemblyPlanItem[] = [];
  for (const ref of input.selectedContextRefs) {
    const planType = asPlanType(ref.type);
    if (!planType) continue;
    out.push({
      type: planType,
      source: String(ref.source ?? "").trim().slice(0, SOURCE_MAX_LEN),
      priority: Number.isFinite(ref.priority) ? Math.max(0, Math.floor(ref.priority)) : 999,
      includeReason: String(ref.reason ?? "").trim().slice(0, REASON_MAX_LEN),
      estimatedCost: estimatedCostOf(ref, planType),
      pruningCandidate: pruningCandidateForOverflow(planType, overflowRisk),
    });
    if (out.length >= OVERLAY_ASSEMBLY_PLAN_ITEMS_MAX) break;
  }
  return out;
}

export function parseOverlayAssemblyPlanFromUnknown(
  raw: unknown
): readonly OverlayAssemblyPlanItem[] {
  if (!Array.isArray(raw)) return [];
  const out: OverlayAssemblyPlanItem[] = [];
  for (const item of raw) {
    if (out.length >= OVERLAY_ASSEMBLY_PLAN_ITEMS_MAX) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const planType = String(r.type ?? "").trim() as OverlayAssemblyPlanItemType;
    if (!VALID_PLAN_TYPES.has(planType)) continue;
    const source = String(r.source ?? "").trim().slice(0, SOURCE_MAX_LEN);
    const includeReason = String(r.includeReason ?? "").trim().slice(0, REASON_MAX_LEN);
    if (!source || !includeReason) continue;
    const priorityRaw = Number(r.priority);
    const priority = Number.isFinite(priorityRaw) ? Math.max(0, Math.floor(priorityRaw)) : 999;
    const costRaw = Number(r.estimatedCost);
    const estimatedCost = Number.isFinite(costRaw) ? Math.max(1, Math.floor(costRaw)) : 1;
    const pruningCandidate = r.pruningCandidate === true;
    out.push({ type: planType, source, priority, includeReason, estimatedCost, pruningCandidate });
  }
  return out;
}

export type OverlayAssemblyPlanSummaryWire = Readonly<{
  totalItems: number;
  highPriorityItems: number;
  pruningCandidateCount: number;
  byType: Readonly<Record<OverlayAssemblyPlanItemType, number>>;
  totalEstimatedCost: number;
  budgetPolicy: OverlayContextBudgetPolicy | null;
  overflowRisk: OverlayContextBudgetOverflowRisk | null;
}>;

export function summarizeOverlayAssemblyPlan(input: {
  plan: readonly OverlayAssemblyPlanItem[];
  budgetMetadata?: OverlayContextBudgetMetadata | null;
}): OverlayAssemblyPlanSummaryWire {
  const byType: Record<OverlayAssemblyPlanItemType, number> = {
    memory: 0,
    knowledge: 0,
    timeline: 0,
    workspace: 0,
    policy: 0,
  };
  let highPriorityItems = 0;
  let pruningCandidateCount = 0;
  let totalEstimatedCost = 0;
  for (const item of input.plan) {
    if (byType[item.type] !== undefined) byType[item.type]++;
    if (item.priority <= OVERLAY_ASSEMBLY_PLAN_HIGH_PRIORITY_THRESHOLD) highPriorityItems++;
    if (item.pruningCandidate) pruningCandidateCount++;
    totalEstimatedCost += item.estimatedCost;
  }
  return {
    totalItems: input.plan.length,
    highPriorityItems,
    pruningCandidateCount,
    byType,
    totalEstimatedCost,
    budgetPolicy: input.budgetMetadata?.budgetPolicy ?? null,
    overflowRisk: input.budgetMetadata?.overflowRisk ?? null,
  };
}
