import type { PlanningResetCascadeReason } from "@/lib/requirements/planningResetCascadeService";

export type PlanningKnowledgeGraphTraceV1 = Readonly<{
  readonly version: 1;
  readonly lastPlanningGraphResetAt: string | null;
  readonly lastPlanningGraphResetReason: PlanningResetCascadeReason | null;
  readonly lastGraphAppliedAt: string | null;
}>;

export function defaultPlanningKnowledgeGraphTraceV1(): PlanningKnowledgeGraphTraceV1 {
  return {
    version: 1,
    lastPlanningGraphResetAt: null,
    lastPlanningGraphResetReason: null,
    lastGraphAppliedAt: null,
  };
}

export function parsePlanningKnowledgeGraphTraceV1(raw: unknown): PlanningKnowledgeGraphTraceV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const reasonRaw = o.lastPlanningGraphResetReason;
  const reason =
    reasonRaw === "planning_reset" || reasonRaw === "planning_regenerated" || reasonRaw === "manual"
      ? reasonRaw
      : null;
  return {
    version: 1,
    lastPlanningGraphResetAt:
      typeof o.lastPlanningGraphResetAt === "string" ? o.lastPlanningGraphResetAt : null,
    lastPlanningGraphResetReason: reason,
    lastGraphAppliedAt: typeof o.lastGraphAppliedAt === "string" ? o.lastGraphAppliedAt : null,
  };
}

export function buildPlanningKnowledgeGraphTraceAfterReset(input: Readonly<{
  readonly nowIso: string;
  readonly reason: PlanningResetCascadeReason;
}>): PlanningKnowledgeGraphTraceV1 {
  return {
    version: 1,
    lastPlanningGraphResetAt: input.nowIso,
    lastPlanningGraphResetReason: input.reason,
    lastGraphAppliedAt: null,
  };
}

export type PlanningKnowledgeGraphRegenerationHint =
  | "empty_after_reset"
  | "regenerated_after_reset"
  | "stale_or_unknown";

export function resolvePlanningKnowledgeGraphRegenerationHint(input: Readonly<{
  readonly trace: PlanningKnowledgeGraphTraceV1 | null;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly lastGraphAppliedAt: string | null;
}>): PlanningKnowledgeGraphRegenerationHint {
  const resetAt = input.trace?.lastPlanningGraphResetAt?.trim() ?? "";
  if (!resetAt) {
    if (input.nodeCount === 0 && input.edgeCount === 0) return "empty_after_reset";
    return "stale_or_unknown";
  }
  const appliedAt = input.lastGraphAppliedAt?.trim() ?? "";
  if (input.nodeCount === 0 && input.edgeCount === 0) {
    return "empty_after_reset";
  }
  if (appliedAt && appliedAt > resetAt) {
    return "regenerated_after_reset";
  }
  return "stale_or_unknown";
}

export function planningKnowledgeGraphRegenerationUserMessage(
  hint: PlanningKnowledgeGraphRegenerationHint,
): string {
  if (hint === "empty_after_reset") {
    return "기획 초기화 후 아직 생성된 Knowledge Graph가 없습니다. AI 기획자 응답이나 사용자의 선택이 반영되면 새 그래프가 생성됩니다.";
  }
  if (hint === "regenerated_after_reset") {
    return "현재 그래프는 초기화 이후 새로 생성된 구조입니다.";
  }
  return "현재 그래프 상태를 확인 중입니다. 새로고침해 주세요.";
}
