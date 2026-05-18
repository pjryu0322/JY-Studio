import { IDEATION_DELIVERABLE_LABELS, type IdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";

export type PlannerDeliverableType = IdeationDeliverableType;

export type PlannerSlotSchema = {
  type: PlannerDeliverableType;
  labelKr: string;
  requiredSlots: readonly string[];
};

const SLOT_REGISTRY: Record<PlannerDeliverableType, readonly string[]> = {
  meeting_summary: ["논의 주제", "주요 결정사항", "미결정 이슈", "담당자", "다음 액션"],
  problem_statement: ["핵심 사용자", "현재 문제점", "기존 해결 방식", "개선 필요성", "우선 고객군"],
  feature_list: ["핵심 사용자", "주요 업무 흐름", "필요한 기능", "우선순위", "제외 범위"],
  mvp_scope: ["핵심 기능", "출시 목표", "제외 기능", "제한 자원", "일정 목표"],
  kpi: ["목표 행동", "측정 지표", "목표 수치", "측정 주기", "성공 기준"],
  full_plan: ["목표", "사용자", "문제정의", "기능", "MVP", "KPI", "로드맵"],
};

export const PLANNER_DELIVERABLE_TYPES: readonly PlannerDeliverableType[] = [
  "meeting_summary",
  "problem_statement",
  "feature_list",
  "mvp_scope",
  "kpi",
  "full_plan",
] as const;

export function plannerDeliverableLabelKr(type: PlannerDeliverableType): string {
  return IDEATION_DELIVERABLE_LABELS[type] ?? type;
}

export function getPlannerSlotSchema(type: PlannerDeliverableType): PlannerSlotSchema {
  const requiredSlots = SLOT_REGISTRY[type] ?? ["핵심 사용자", "핵심 목표", "핵심 기능", "성공 기준"];
  return { type, labelKr: plannerDeliverableLabelKr(type), requiredSlots };
}

