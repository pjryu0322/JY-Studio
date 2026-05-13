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

const PLAN_TYPES = ["memory", "knowledge", "timeline", "workspace", "policy"] as const;
const VALID_PLAN_TYPES = new Set<OverlayAssemblyPlanItemType>(PLAN_TYPES);

const SOURCE_MAX_LEN = 240;
const REASON_MAX_LEN = 120;
const DEFAULT_LOW_PRIORITY = 999;
const MIN_ESTIMATED_COST = 1;
const COST_SOURCE_LENGTH_DIVISOR = 4;

/** 행당 plan item 상한(타임라인 비대화 방지). */
export const OVERLAY_ASSEMBLY_PLAN_ITEMS_MAX = 32;

/** 우선순위 임계값: plan item이 "high priority"로 간주되는 기준(`priority <= HIGH_PRIORITY_THRESHOLD`). */
export const OVERLAY_ASSEMBLY_PLAN_HIGH_PRIORITY_THRESHOLD = 20;

/** estimatedCost 산출용 기본 비용(휴리스틱). */
const BASE_COST_BY_TYPE: Readonly<Record<OverlayAssemblyPlanItemType, number>> = {
  memory: 40,
  knowledge: 60,
  timeline: 25,
  workspace: 15,
  policy: 10,
};

/** overflow 단계별 pruning 후보로 간주하는 type 집합. `low`는 아무것도 줄이지 않는다. */
const PRUNING_TYPES_BY_OVERFLOW: Readonly<
  Record<OverlayContextBudgetOverflowRisk, ReadonlySet<OverlayAssemblyPlanItemType>>
> = {
  low: new Set<OverlayAssemblyPlanItemType>(),
  medium: new Set<OverlayAssemblyPlanItemType>(["timeline", "workspace"]),
  high: new Set<OverlayAssemblyPlanItemType>(["timeline", "workspace", "knowledge"]),
};

function emptyByType(): Record<OverlayAssemblyPlanItemType, number> {
  return PLAN_TYPES.reduce(
    (acc, t) => {
      acc[t] = 0;
      return acc;
    },
    {} as Record<OverlayAssemblyPlanItemType, number>
  );
}

function trimSlice(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function coercePriority(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : DEFAULT_LOW_PRIORITY;
}

function coerceEstimatedCost(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(MIN_ESTIMATED_COST, Math.floor(n)) : MIN_ESTIMATED_COST;
}

function pruningCandidateForOverflow(
  type: OverlayAssemblyPlanItemType,
  overflowRisk: OverlayContextBudgetOverflowRisk | null
): boolean {
  if (!overflowRisk) return false;
  return PRUNING_TYPES_BY_OVERFLOW[overflowRisk].has(type);
}

function estimatedCostOf(item: OverlaySelectedContextRef, planType: OverlayAssemblyPlanItemType): number {
  const base = BASE_COST_BY_TYPE[planType];
  const sourceLen = typeof item.source === "string" ? item.source.length : 0;
  return Math.max(MIN_ESTIMATED_COST, Math.floor(base + sourceLen / COST_SOURCE_LENGTH_DIVISOR));
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
      source: trimSlice(ref.source, SOURCE_MAX_LEN),
      priority: coercePriority(ref.priority),
      includeReason: trimSlice(ref.reason, REASON_MAX_LEN),
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
    const planType = trimSlice(r.type, 32) as OverlayAssemblyPlanItemType;
    if (!VALID_PLAN_TYPES.has(planType)) continue;
    const source = trimSlice(r.source, SOURCE_MAX_LEN);
    const includeReason = trimSlice(r.includeReason, REASON_MAX_LEN);
    if (!source || !includeReason) continue;
    out.push({
      type: planType,
      source,
      priority: coercePriority(r.priority),
      includeReason,
      estimatedCost: coerceEstimatedCost(r.estimatedCost),
      pruningCandidate: r.pruningCandidate === true,
    });
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
  const byType = emptyByType();
  let highPriorityItems = 0;
  let pruningCandidateCount = 0;
  let totalEstimatedCost = 0;
  for (const item of input.plan) {
    byType[item.type]++;
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
