/**
 * Bootstrap 멀티 에이전트 reasoning 힌트 — 결정 축 로테이션(결정적, DB 없음).
 */

export const BOOTSTRAP_DECISION_AXIS_ORDER = [
  "workflow-branching",
  "collaboration-boundary",
  "approval-responsibility",
  "automation-level",
  "quality-validation",
  "prototype-boundary",
  "editing-authority",
  "realtime-batch-distinction",
] as const;

export type BootstrapDecisionAxisId = (typeof BOOTSTRAP_DECISION_AXIS_ORDER)[number];

/** 프로젝트 문맥 문자열로 우선 탐색할 축을 고정(세션 간 재현 가능). */
export function pickBootstrapDecisionAxisRotation(input: {
  readonly projectName: string;
  readonly projectDescription: string;
}): {
  readonly preferredAxis: BootstrapDecisionAxisId;
  readonly secondaryAxis: BootstrapDecisionAxisId;
} {
  const seed = `${input.projectName}\n${input.projectDescription}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h >>> 0) % BOOTSTRAP_DECISION_AXIS_ORDER.length;
  const preferredAxis = BOOTSTRAP_DECISION_AXIS_ORDER[idx]!;
  const secondaryAxis = BOOTSTRAP_DECISION_AXIS_ORDER[(idx + 3) % BOOTSTRAP_DECISION_AXIS_ORDER.length]!;
  return { preferredAxis, secondaryAxis };
}

export function formatBootstrapAxisRotationBlock(input: {
  readonly projectName: string;
  readonly projectDescription: string;
}): string {
  const { preferredAxis, secondaryAxis } = pickBootstrapDecisionAxisRotation(input);
  return `[bootstrap_axis_rotation]
이번 호출에서 우선 탐색할 orchestration decision 축(프로젝트 문맥 해시 기반): primary=${preferredAxis}, secondary=${secondaryAxis}
동일 축(특히 approval-responsibility만)으로 매번 고정되지 않도록, 위 primary가 프로젝트에 덜 맞으면 secondary·연관 축을 우선 고려한다.
질문은 단일 축만 다루되, planner만이 아니라 analyst·architect 관점이 드러나도록 선택한다.`;
}
