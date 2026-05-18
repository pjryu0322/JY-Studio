/**
 * Overlay: **context prioritization** — selection 결과를 budget policy에 맞춰 정렬한다.
 *
 * **이 헬퍼는 metadata sorting만 수행한다.** 실제 prompt assembly·payload·라우팅 변경 없음.
 * 정렬 결과는 추후 assembly engine이 참조할 수 있는 read-only 우선순위 metadata다.
 */

import type {
  OverlaySelectedContextRef,
  OverlaySelectedContextRefType,
} from "@/lib/overlay/overlayContextSelection";
import type { OverlayContextBudgetPolicy } from "@/lib/overlay/overlayContextBudget";

/**
 * Budget policy별 type 우선순위 가중치.
 * - 낮을수록 먼저 정렬됨(우선).
 * - `compact`: role/policy/memory 우선, timeline/workspace 후순위.
 * - `extended`: timeline/workspace를 허용 증가.
 * - `balanced`/`default`는 균등.
 */
const POLICY_TYPE_WEIGHT: Readonly<
  Record<OverlayContextBudgetPolicy, Readonly<Record<OverlaySelectedContextRefType, number>>>
> = {
  compact: { role: 0, policy: 1, memory: 2, knowledge: 4, workspace: 8, timeline: 10 },
  balanced: { role: 0, policy: 2, memory: 3, knowledge: 3, timeline: 4, workspace: 4 },
  default: { role: 0, policy: 2, memory: 3, knowledge: 3, timeline: 4, workspace: 4 },
  extended: { role: 0, policy: 2, memory: 3, knowledge: 3, timeline: 2, workspace: 2 },
};

function compareRefsForPolicy(
  a: OverlaySelectedContextRef,
  b: OverlaySelectedContextRef,
  policy: OverlayContextBudgetPolicy
): number {
  const w = POLICY_TYPE_WEIGHT[policy];
  const aw = w[a.type] ?? 99;
  const bw = w[b.type] ?? 99;
  if (aw !== bw) return aw - bw;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.source.localeCompare(b.source);
}

export function prioritizeOverlayContexts(input: {
  contexts: readonly OverlaySelectedContextRef[];
  budgetPolicy: OverlayContextBudgetPolicy;
}): readonly OverlaySelectedContextRef[] {
  return [...input.contexts].sort((a, b) => compareRefsForPolicy(a, b, input.budgetPolicy));
}
