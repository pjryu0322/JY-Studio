/** 기능정리 동적 체크리스트 타입 — 슬롯 아티팩트와 LLM analyze 간 공유 */

export type FeaturePlanningChecklistSlotV1 = {
  readonly slotKey: string;
  readonly label: string;
  readonly required: boolean;
  readonly priority: "HIGH" | "MEDIUM" | "LOW" | string;
  readonly question: string;
  readonly examples?: readonly string[];
  completed?: boolean;
  valueSummary?: string;
};

export type FeaturePlanningChecklistAreaV1 = {
  readonly areaKey: string;
  readonly title: string;
  readonly purpose: string;
  readonly requiredScore: number;
  readonly slots: readonly FeaturePlanningChecklistSlotV1[];
};

export type FeaturePlanningPlanningChecklistV1 = {
  readonly version: number;
  readonly areas: readonly FeaturePlanningChecklistAreaV1[];
  activeAreaIndex: number;
};
