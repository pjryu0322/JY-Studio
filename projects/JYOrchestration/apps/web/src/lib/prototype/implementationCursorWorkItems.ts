import type { ImplementationTaskPlanItem, ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import { evaluateImplementationTaskPlanReadiness } from "@/lib/prototype/implementationTaskPlan";

export type CursorWorkItem = Readonly<{
  id: string;
  taskId: string;
  title: string;
  prompt: string;
  requiredFilesHint: readonly string[];
  expectedOutput: readonly string[];
  blocked: boolean;
  blockers: readonly string[];
}>;

export function buildCursorWorkItemsFromImplementationTaskPlan(
  plan: ImplementationTaskPlanV1,
): readonly CursorWorkItem[] {
  return plan.items.map((item) => toCursorWorkItem(item));
}

function toCursorWorkItem(item: ImplementationTaskPlanItem): CursorWorkItem {
  return {
    id: `cursor-wi-${item.id}`,
    taskId: item.id,
    title: item.title,
    prompt: item.cursorPromptDraft,
    requiredFilesHint: item.sourceArtifactTypes.map((t) => `artifact:${t}`),
    expectedOutput: [
      "변경된 소스 파일 목록",
      "동작 검증 요약",
      "미해결 이슈(있을 경우)",
    ],
    blocked: item.status === "blocked" || item.blockers.length > 0,
    blockers: item.blockers,
  };
}

export type CursorExecutionRequestGateInput = Readonly<{
  readonly plan: ImplementationTaskPlanV1 | null | undefined;
  readonly workItems: readonly CursorWorkItem[] | null | undefined;
  readonly envOk: boolean;
  readonly designOk: boolean;
}>;

export function evaluateCursorExecutionRequestGate(input: CursorExecutionRequestGateInput): Readonly<{
  allowed: boolean;
  missing: readonly string[];
}> {
  const missing: string[] = [];
  const readiness = evaluateImplementationTaskPlanReadiness({
    plan: input.plan,
    envOk: input.envOk,
    designOk: input.designOk,
  });
  if (!readiness.ready) missing.push(...readiness.missing);
  const items = input.workItems ?? [];
  if (!items.length) missing.push("Cursor work item 없음");
  if (items.some((w) => w.blocked)) missing.push("차단된 task 존재");
  const uniq = [...new Set(missing)];
  return { allowed: uniq.length === 0, missing: uniq };
}

export function formatCursorExecutionBlockedMessage(missing: readonly string[]): string {
  return [
    "아직 Cursor 실행 요청을 진행할 수 없습니다.",
    "",
    "부족 항목:",
    ...missing.map((m) => `- ${m}`),
  ].join("\n");
}
