import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { CURSOR_WORK_ITEM_MIN_QUALITY_SCORE, isCursorWorkItemPromptReady } from "@/lib/prototype/implementationCursorPromptQuality";
import {
  evaluateImplementationTaskPlanReadiness,
  IMPLEMENTATION_TASK_PLAN_SUMMARY_INTERNAL_TYPE,
  type ImplementationTaskPlanV1,
} from "@/lib/prototype/implementationTaskPlan";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export function summarizeTaskPlanExecutionStats(
  plan: ImplementationTaskPlanV1,
  workItems: readonly CursorWorkItem[],
): Readonly<{
  taskCount: number;
  workItemCount: number;
  runnableCount: number;
  blockedCount: number;
  promptReadyCount: number;
  primaryTestCommands: readonly string[];
}> {
  const runnableCount = workItems.filter((w) => !w.blocked && isCursorWorkItemPromptReady(w)).length;
  const blockedCount = workItems.length - runnableCount;
  const promptReadyCount = workItems.filter((w) => isCursorWorkItemPromptReady(w)).length;
  const testSet = new Set<string>();
  for (const item of plan.items) {
    for (const cmd of item.executionHints.testCommands) {
      if (cmd.startsWith("pnpm test") || cmd === "pnpm build") testSet.add(cmd);
    }
  }
  return {
    taskCount: plan.items.length,
    workItemCount: workItems.length,
    runnableCount,
    blockedCount,
    promptReadyCount,
    primaryTestCommands: [...testSet].slice(0, 6),
  };
}

export function buildImplementationTaskPlanSummaryContent(
  plan: ImplementationTaskPlanV1,
  input: { readonly workItems: readonly CursorWorkItem[]; readonly envOk: boolean; readonly designOk: boolean },
): string {
  const stats = summarizeTaskPlanExecutionStats(plan, input.workItems);
  const lines = [
    "구현 작업안을 정리했습니다.",
    "",
    `- 구현 task: ${stats.taskCount}개`,
    `- Cursor 실행 단위: ${stats.workItemCount}개`,
    `- 실행 가능: ${stats.runnableCount}개`,
    `- 차단·품질 미충족: ${stats.blockedCount}개`,
    `- prompt 준비 완료: ${stats.promptReadyCount}개`,
    "",
    "우선 구현 task:",
    ...plan.items.map((it, i) => `${i + 1}. ${it.title}${it.blockers.length ? " (환경·설계 차단)" : ""}`),
    "",
    "주요 테스트:",
    ...stats.primaryTestCommands.map((c) => `- \`${c}\``),
    "",
    "각 task prompt에는 작업 목적·예상 수정 위치·테스트 명령·검수/보안 기준·금지사항이 포함되어 있습니다.",
  ];

  if (plan.readiness.ready && stats.runnableCount === stats.workItemCount && stats.workItemCount > 0) {
    lines.push("", "환경·설계·prompt 품질이 충족되었습니다. Cursor 실행 요청을 진행할 수 있습니다.");
  } else if (!input.envOk || !input.designOk) {
    lines.push(
      "",
      "환경·설계 준비가 부족하면 Cursor 실행 요청은 차단됩니다. [환경설정 열기]로 연결 상태를 먼저 완료해 주세요.",
    );
  } else {
    lines.push("", "Cursor 실행 요청 전 보완이 필요한 항목이 있을 수 있습니다. task별 prompt·테스트 범위를 확인해 주세요.");
  }

  if (!plan.readiness.ready && plan.readiness.missing.length) {
    lines.push("", "부족 항목:", ...plan.readiness.missing.map((m) => `- ${m}`));
  }
  return lines.join("\n");
}

export function implementationTaskPlanSummaryChips(input: {
  readonly plan: ImplementationTaskPlanV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly envOk: boolean;
  readonly designOk: boolean;
}): readonly string[] {
  const base = ["작업 범위 수정", "산출물 다시 보기", "환경설정 열기"];
  const readiness = evaluateImplementationTaskPlanReadiness({
    plan: input.plan,
    envOk: input.envOk,
    designOk: input.designOk,
  });
  const qualityOk =
    input.workItems.length > 0 &&
    input.workItems.every(
      (w) =>
        !w.blocked &&
        w.qualityGate.promptReady &&
        w.qualityGate.score >= CURSOR_WORK_ITEM_MIN_QUALITY_SCORE,
    );
  if (readiness.ready && qualityOk) return [...base, "Cursor 실행 요청", "구현 실행 준비"];
  return [...base, "구현 실행 준비"];
}

export function buildImplementationTaskPlanSummaryMessage(
  plan: ImplementationTaskPlanV1,
  input: {
    readonly workItems: readonly CursorWorkItem[];
    readonly envOk: boolean;
    readonly designOk: boolean;
    readonly nowIso?: string;
  },
): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const chips = implementationTaskPlanSummaryChips({
    plan,
    workItems: input.workItems,
    envOk: input.envOk,
    designOk: input.designOk,
  });
  return newRequirementsMessage({
    id: `impl-task-plan-summary-${plan.createdAt}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: buildImplementationTaskPlanSummaryContent(plan, input),
    createdAt: input.nowIso ?? new Date().toISOString(),
    meta: {
      internalType: IMPLEMENTATION_TASK_PLAN_SUMMARY_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: [...chips],
      interviewAllowCustomInput: true,
    },
  });
}
