import type { ImplementationWorkingQueueV1 } from "@/lib/prototype/implementationWorkingQueueTypes";

export function buildIntentClarificationMessage(input: Readonly<{
  readonly pendingCount: number;
  readonly hasRunnableCodeTasks?: boolean;
}>): string {
  const lines = [
    "현재 요청의 실행 대상을 확정하지 못했습니다.",
    "",
    "진행할 작업을 선택해 주세요.",
  ];
  if (input.pendingCount > 0) {
    lines.push(`1. 작업대기 항목 승인 (${input.pendingCount}건)`);
  }
  if (input.hasRunnableCodeTasks) {
    lines.push("2. 초기 구현 빠른실행 시작");
  }
  lines.push(`${input.pendingCount > 0 || input.hasRunnableCodeTasks ? "3" : "1"}. 보완요청 다시 작성`);
  lines.push("");
  lines.push("예: 「1번만 진행해」, 「작업대기 승인」, 「빠른실행 시작」처럼 구체적으로 말씀해 주세요.");
  return lines.join("\n");
}

export function buildIntentClarificationTimelineDetail(): string {
  return "clarification_required · no_rule_based_control_intent";
}

export function pendingCountFromQueue(queue: ImplementationWorkingQueueV1): number {
  return queue.items.filter((i) => i.status === "pending").length;
}
