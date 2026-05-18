/**
 * Overlay: **Policy-guided Context Assembly Preparation Layer**의 핵심 metadata.
 *
 * **이 헬퍼는 prompt 본문을 조립하지 않는다.** 어떤 context가 prompt assembly에 우선
 * 사용되어야 하는지를 추적·계획하기 위한 read-only metadata만 만든다. 실제 assembly,
 * payload, 라우팅 어느 것도 변경하지 않는다.
 *
 * Stabilization layer 보강: 항목별 `includeMode`(required/recommended/optional/excludeCandidate)와
 * type+budget 기반의 cost multiplier를 도입해 prioritization·pruning·drift 검사가 일관된 기준을
 * 사용할 수 있도록 한다.
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

export type OverlayAssemblyIncludeMode =
  | "required"
  | "recommended"
  | "optional"
  | "excludeCandidate";

export type OverlayAssemblyPlanItem = Readonly<{
  type: OverlayAssemblyPlanItemType;
  source: string;
  /** 0(최우선) → 큰 값(낮음). 동일 type 내부에서 정렬 가능. */
  priority: number;
  /** 왜 포함되어야 하는지(예: `role_memory_scope`, `role_knowledge_hint`). */
  includeReason: string;
  /** heuristic 비용 단위(type·budget·소스 길이 등에서 파생). 실제 토큰 측정 아님. */
  estimatedCost: number;
  /** budget overflow 시 우선 줄여야 할 후보 여부(legacy boolean, includeMode와 함께 유지). */
  pruningCandidate: boolean;
  /** planning-level inclusion 분류. **실제 include/exclude 수행은 하지 않는다.** */
  includeMode: OverlayAssemblyIncludeMode;
}>;

const PLAN_TYPES = ["memory", "knowledge", "timeline", "workspace", "policy"] as const;
const VALID_PLAN_TYPES = new Set<OverlayAssemblyPlanItemType>(PLAN_TYPES);

const INCLUDE_MODES = ["required", "recommended", "optional", "excludeCandidate"] as const;
const VALID_INCLUDE_MODES = new Set<OverlayAssemblyIncludeMode>(INCLUDE_MODES);

const SOURCE_MAX_LEN = 240;
const REASON_MAX_LEN = 120;
const DEFAULT_LOW_PRIORITY = 999;
const MIN_ESTIMATED_COST = 1;
const COST_SOURCE_LENGTH_DIVISOR = 4;

/** 행당 plan item 상한(타임라인 비대화 방지). */
export const OVERLAY_ASSEMBLY_PLAN_ITEMS_MAX = 32;

/** 우선순위 임계값: plan item이 "high priority"로 간주되는 기준(`priority <= HIGH_PRIORITY_THRESHOLD`). */
export const OVERLAY_ASSEMBLY_PLAN_HIGH_PRIORITY_THRESHOLD = 20;

/** excludeCandidate로 분류되는 priority 임계값(`priority >= LOW_PRIORITY_THRESHOLD`). */
export const OVERLAY_ASSEMBLY_PLAN_LOW_PRIORITY_THRESHOLD = 28;

/** estimatedCost 산출용 기본 비용(휴리스틱, multiplier 1 기준). */
const BASE_COST_BY_TYPE: Readonly<Record<OverlayAssemblyPlanItemType, number>> = {
  memory: 40,
  knowledge: 60,
  timeline: 25,
  workspace: 15,
  policy: 10,
};

/**
 * type별 기본 multiplier — role/policy는 저비용, timeline/workspace는 고비용.
 * compact/extended budget policy에서 timeline/workspace 가중을 보정한다.
 */
const TYPE_BASE_MULTIPLIER: Readonly<Record<OverlayAssemblyPlanItemType, number>> = {
  memory: 1.0,
  knowledge: 1.0,
  timeline: 1.2,
  workspace: 1.2,
  policy: 0.8,
};

/** compact는 timeline/workspace 비용을 추가로 증가, extended는 감소시킨다. */
const POLICY_TYPE_MULTIPLIER: Readonly<
  Record<OverlayContextBudgetPolicy, Partial<Record<OverlayAssemblyPlanItemType, number>>>
> = {
  compact: { timeline: 1.4, workspace: 1.4 },
  balanced: {},
  default: {},
  extended: { timeline: 0.7, workspace: 0.7 },
};

/** type → required/recommended/optional 기본 분류. */
const DEFAULT_INCLUDE_MODE_BY_TYPE: Readonly<Record<OverlayAssemblyPlanItemType, OverlayAssemblyIncludeMode>> = {
  policy: "required",
  memory: "recommended",
  knowledge: "recommended",
  workspace: "optional",
  timeline: "optional",
};

/** overflow 단계별 pruning 후보로 간주하는 type 집합. `low`는 아무것도 줄이지 않는다. */
const PRUNING_TYPES_BY_OVERFLOW: Readonly<
  Record<OverlayContextBudgetOverflowRisk, ReadonlySet<OverlayAssemblyPlanItemType>>
> = {
  low: new Set<OverlayAssemblyPlanItemType>(),
  medium: new Set<OverlayAssemblyPlanItemType>(["timeline", "workspace"]),
  high: new Set<OverlayAssemblyPlanItemType>(["timeline", "workspace", "knowledge"]),
};

function emptyByType<T>(zero: T): Record<OverlayAssemblyPlanItemType, T> {
  return PLAN_TYPES.reduce(
    (acc, t) => {
      acc[t] = zero;
      return acc;
    },
    {} as Record<OverlayAssemblyPlanItemType, T>
  );
}

function emptyByIncludeMode(): Record<OverlayAssemblyIncludeMode, number> {
  return INCLUDE_MODES.reduce(
    (acc, m) => {
      acc[m] = 0;
      return acc;
    },
    {} as Record<OverlayAssemblyIncludeMode, number>
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

function resolveTypeCostMultiplier(
  type: OverlayAssemblyPlanItemType,
  policy: OverlayContextBudgetPolicy | null
): number {
  const base = TYPE_BASE_MULTIPLIER[type];
  const policyAdj = policy ? POLICY_TYPE_MULTIPLIER[policy][type] ?? 1 : 1;
  return base * policyAdj;
}

function estimatedCostOf(
  item: OverlaySelectedContextRef,
  planType: OverlayAssemblyPlanItemType,
  policy: OverlayContextBudgetPolicy | null
): number {
  const base = BASE_COST_BY_TYPE[planType];
  const sourceLen = typeof item.source === "string" ? item.source.length : 0;
  const raw = (base + sourceLen / COST_SOURCE_LENGTH_DIVISOR) * resolveTypeCostMultiplier(planType, policy);
  return Math.max(MIN_ESTIMATED_COST, Math.floor(raw));
}

/**
 * `includeMode` 분류:
 * - policy → required, memory/knowledge → recommended, workspace/timeline → optional.
 * - 단, overflowRisk=high + 낮은 우선순위 timeline/workspace는 **excludeCandidate**로 강등.
 */
function resolveIncludeMode(
  type: OverlayAssemblyPlanItemType,
  priority: number,
  overflowRisk: OverlayContextBudgetOverflowRisk | null
): OverlayAssemblyIncludeMode {
  if (
    overflowRisk === "high" &&
    (type === "timeline" || type === "workspace") &&
    priority >= OVERLAY_ASSEMBLY_PLAN_LOW_PRIORITY_THRESHOLD
  ) {
    return "excludeCandidate";
  }
  return DEFAULT_INCLUDE_MODE_BY_TYPE[type];
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
  const budgetPolicy = input.budgetMetadata?.budgetPolicy ?? null;
  const out: OverlayAssemblyPlanItem[] = [];
  for (const ref of input.selectedContextRefs) {
    const planType = asPlanType(ref.type);
    if (!planType) continue;
    const priority = coercePriority(ref.priority);
    out.push({
      type: planType,
      source: trimSlice(ref.source, SOURCE_MAX_LEN),
      priority,
      includeReason: trimSlice(ref.reason, REASON_MAX_LEN),
      estimatedCost: estimatedCostOf(ref, planType, budgetPolicy),
      pruningCandidate: pruningCandidateForOverflow(planType, overflowRisk),
      includeMode: resolveIncludeMode(planType, priority, overflowRisk),
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
    const priority = coercePriority(r.priority);
    const rawMode = trimSlice(r.includeMode, 32) as OverlayAssemblyIncludeMode;
    const includeMode: OverlayAssemblyIncludeMode = VALID_INCLUDE_MODES.has(rawMode)
      ? rawMode
      : DEFAULT_INCLUDE_MODE_BY_TYPE[planType];
    out.push({
      type: planType,
      source,
      priority,
      includeReason,
      estimatedCost: coerceEstimatedCost(r.estimatedCost),
      pruningCandidate: r.pruningCandidate === true || includeMode === "excludeCandidate",
      includeMode,
    });
  }
  return out;
}

export type OverlayAssemblyPlanSummaryWire = Readonly<{
  totalItems: number;
  highPriorityItems: number;
  pruningCandidateCount: number;
  byType: Readonly<Record<OverlayAssemblyPlanItemType, number>>;
  byIncludeMode: Readonly<Record<OverlayAssemblyIncludeMode, number>>;
  totalEstimatedCost: number;
  budgetPolicy: OverlayContextBudgetPolicy | null;
  overflowRisk: OverlayContextBudgetOverflowRisk | null;
}>;

export type OverlayAssemblyIncludeModeSummaryWire = Readonly<
  Record<OverlayAssemblyIncludeMode, number>
>;

export function summarizeOverlayAssemblyPlan(input: {
  plan: readonly OverlayAssemblyPlanItem[];
  budgetMetadata?: OverlayContextBudgetMetadata | null;
}): OverlayAssemblyPlanSummaryWire {
  const byType = emptyByType(0);
  const byIncludeMode = emptyByIncludeMode();
  let highPriorityItems = 0;
  let pruningCandidateCount = 0;
  let totalEstimatedCost = 0;
  for (const item of input.plan) {
    byType[item.type]++;
    byIncludeMode[item.includeMode]++;
    if (item.priority <= OVERLAY_ASSEMBLY_PLAN_HIGH_PRIORITY_THRESHOLD) highPriorityItems++;
    if (item.pruningCandidate) pruningCandidateCount++;
    totalEstimatedCost += item.estimatedCost;
  }
  return {
    totalItems: input.plan.length,
    highPriorityItems,
    pruningCandidateCount,
    byType,
    byIncludeMode,
    totalEstimatedCost,
    budgetPolicy: input.budgetMetadata?.budgetPolicy ?? null,
    overflowRisk: input.budgetMetadata?.overflowRisk ?? null,
  };
}

export function summarizeOverlayAssemblyIncludeMode(
  plan: readonly OverlayAssemblyPlanItem[]
): OverlayAssemblyIncludeModeSummaryWire {
  const out = emptyByIncludeMode();
  for (const item of plan) out[item.includeMode]++;
  return out;
}
