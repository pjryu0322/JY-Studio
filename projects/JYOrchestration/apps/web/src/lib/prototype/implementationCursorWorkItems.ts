import {
  CURSOR_WORK_ITEM_MIN_QUALITY_SCORE,
  evaluateCursorWorkItemQuality,
  type CursorWorkItemQualityGate,
} from "@/lib/prototype/implementationCursorPromptQuality";
import { appendWipPolicyToCodeAgentPrompt } from "@/lib/prototype/codeAgentWipExecution";
import type { ImplementationTaskPlanItem, ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import { evaluateImplementationTaskPlanReadiness } from "@/lib/prototype/implementationTaskPlan";
import { buildCursorPromptDraft } from "@/lib/prototype/implementationTaskPlan";
import {
  buildImplementationTaskExecutionHints,
  COMMON_FORBIDDEN_PATHS,
} from "@/lib/prototype/implementationExecutionHints";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import { getActiveReworkRequestsForTask } from "@/lib/prototype/implementationExecutionBoardState";
import {
  formatImplementationQualityGateFailureLinesForTask,
  type ImplementationQualityGateResultV1,
} from "@/lib/prototype/implementationQualityGate";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

export type { CursorWorkItemQualityGate } from "@/lib/prototype/implementationCursorPromptQuality";

export type CursorWorkItem = Readonly<{
  id: string;
  taskId: string;
  title: string;
  prompt: string;
  requiredFilesHint: readonly string[];
  expectedOutput: readonly string[];
  testCommands: readonly string[];
  forbiddenPaths: readonly string[];
  blocked: boolean;
  blockers: readonly string[];
  qualityGate: CursorWorkItemQualityGate;
}>;

export function validateTaskScopedWorkItems(input: {
  readonly selectedTaskId: string;
  readonly selectedWorkItems: readonly CursorWorkItem[];
}): Readonly<{ readonly ok: true } | { readonly ok: false; readonly message: string }> {
  const selectedTaskId = input.selectedTaskId.trim();
  if (!selectedTaskId) {
    return { ok: false, message: "WIP 실행 대상 taskId가 비어 있습니다." };
  }
  if (!input.selectedWorkItems.length) {
    return { ok: false, message: `${selectedTaskId}에 해당하는 Cursor WorkItem이 없습니다.` };
  }
  if (input.selectedWorkItems.some((item) => item.taskId !== selectedTaskId)) {
    return {
      ok: false,
      message: "선택된 WIP 작업의 taskId가 실행 대상 taskId와 일치하지 않습니다.",
    };
  }
  return { ok: true };
}

export function collectCursorWorkItemGateMissing(item: CursorWorkItem): readonly string[] {
  const missing: string[] = [];
  if (!item.testCommands.length) missing.push(`${item.title}: 테스트 명령 없음`);
  if (!item.forbiddenPaths.length) missing.push(`${item.title}: 금지 경로 없음`);
  if (!item.qualityGate.promptReady || item.qualityGate.score < CURSOR_WORK_ITEM_MIN_QUALITY_SCORE) {
    missing.push(`${item.title}: Cursor prompt 품질 부족 (score=${item.qualityGate.score})`);
    const detail = item.qualityGate.missing.slice(0, 4).map((m) => `${item.title}: ${m}`);
    missing.push(...detail);
  }
  const hasLocation =
    item.prompt.includes("## 4. 예상 수정 위치") &&
    (item.requiredFilesHint.length > 0 || item.prompt.includes("### 후보 폴더"));
  if (!hasLocation) missing.push(`${item.title}: 예상 수정 위치 없음`);
  return missing;
}

export function buildCursorWorkItemsFromImplementationTaskPlan(
  plan: ImplementationTaskPlanV1,
): readonly CursorWorkItem[] {
  return plan.items.map((item) => toCursorWorkItem(item));
}

function taskListPriorityToSortKey(p: ImplementationTaskV1["priority"]): number {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

function taskListTaskToArtifactTypes(task: ImplementationTaskV1): readonly string[] {
  switch (task.taskType) {
    case "screen":
      return ["screen-spec"];
    case "api":
      return ["api-spec"];
    case "mock":
    case "data":
      return ["feature-spec"];
    default:
      return ["feature-spec"];
  }
}

export function buildCursorWorkItemsFromImplementationTaskList(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly nowIso?: string;
}): readonly CursorWorkItem[] {
  const tasks = (input.taskList.tasks ?? [])
    .filter((t) => t.ownerRole === "developer" && t.status === "ready")
    .slice()
    .sort((a, b) => taskListPriorityToSortKey(a.priority) - taskListPriorityToSortKey(b.priority));

  const now = input.nowIso ?? new Date().toISOString();

  return tasks.map((task, index) => {
    const sourceArtifactTypes = taskListTaskToArtifactTypes(task);
    const executionHints = buildImplementationTaskExecutionHints({
      taskTitle: task.title,
      sourceArtifactTypes,
      projectArtifacts: [],
    });
    const title = `[${task.taskId}] ${task.title}`;
    const prompt = appendWipPolicyToCodeAgentPrompt(
      buildCursorPromptDraft({
        title,
        description: [
          "기획단계에서 생성된 Implementation Task List 기준 작업입니다.",
          "",
          `작업 ID: ${task.taskId}`,
          "역할: AI 개발자",
          `우선순위: ${task.priority}`,
          "",
          `설명: ${String(task.description ?? "").trim() || task.title}`,
          "",
          "완료 기준:",
          ...(task.acceptanceCriteria?.length ? task.acceptanceCriteria.map((a) => `- ${a}`) : ["- (기준 없음)"]),
        ].join("\n"),
        artifactLabels: sourceArtifactTypes,
        acceptanceCriteria: task.acceptanceCriteria?.length ? [...task.acceptanceCriteria] : [],
        securityChecks: [],
        reviewChecks: [],
        executionHints,
      }),
    );

    const draft: CursorWorkItem = {
      id: `cursor-wi-tasklist-${index + 1}-${task.taskId}`,
      taskId: task.taskId,
      title,
      prompt,
      requiredFilesHint: [`taskList:${input.taskList.version}`, `task:${task.taskId}`],
      expectedOutput: [
        "변경된 소스 파일 목록",
        "실행한 테스트 명령과 결과 요약",
        "핵심 동작 검증 요약",
        "미해결 이슈(있을 경우)",
      ],
      testCommands: executionHints.testCommands,
      forbiddenPaths: executionHints.forbiddenPaths.length ? executionHints.forbiddenPaths : COMMON_FORBIDDEN_PATHS,
      blocked: false,
      blockers: [],
      qualityGate: { promptReady: false, missing: [], score: 0 },
    };
    return { ...draft, qualityGate: evaluateCursorWorkItemQuality(draft) };
  });
}

function toCursorWorkItem(item: ImplementationTaskPlanItem): CursorWorkItem {
  const h = item.executionHints;
  const requiredFilesHint = [
    ...item.sourceArtifactTypes.map((t) => `artifact:${t}`),
    ...h.candidateFiles.slice(0, 6),
    ...h.candidateDirectories.slice(0, 4).map((d) => `dir:${d}`),
  ];
  const draft: CursorWorkItem = {
    id: `cursor-wi-${item.id}`,
    taskId: item.id,
    title: item.title,
    prompt: appendWipPolicyToCodeAgentPrompt(item.cursorPromptDraft),
    requiredFilesHint,
    expectedOutput: [
      "변경된 소스 파일 목록",
      "실행한 테스트 명령과 결과 요약",
      "핵심 동작 검증 요약",
      "미해결 이슈(있을 경우)",
    ],
    testCommands: h.testCommands,
    forbiddenPaths: h.forbiddenPaths,
    blocked: item.status === "blocked" || item.blockers.length > 0,
    blockers: item.blockers,
    qualityGate: { promptReady: false, missing: [], score: 0 },
  };
  return { ...draft, qualityGate: evaluateCursorWorkItemQuality(draft) };
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

  for (const w of items) {
    missing.push(...collectCursorWorkItemGateMissing(w));
  }

  const uniq = [...new Set(missing)];
  return { allowed: uniq.length === 0, missing: uniq };
}

export function evaluateCursorWorkItemsOnlyWipGate(input: {
  readonly workItems: readonly CursorWorkItem[] | null | undefined;
}): Readonly<{ readonly allowed: boolean; readonly missing: readonly string[] }> {
  const missing: string[] = [];
  const items = input.workItems ?? [];
  if (!items.length) missing.push("Cursor work item 없음");
  if (items.some((w) => w.blocked)) missing.push("차단된 task 존재");
  for (const w of items) {
    missing.push(...collectCursorWorkItemGateMissing(w));
  }
  const uniq = [...new Set(missing)];
  return { allowed: uniq.length === 0, missing: uniq };
}

export function enrichCursorWorkItemsWithBoardReworkContext(input: {
  readonly workItems: readonly CursorWorkItem[];
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
}): readonly CursorWorkItem[] {
  return input.workItems.map((item) => {
    const reworkLines = getActiveReworkRequestsForTask(input.boardState, item.taskId).map(
      (r) => `  - [${r.targetRole}] ${r.reason}`,
    );
    const reviewerLines = formatImplementationQualityGateFailureLinesForTask({
      taskId: item.taskId,
      qualityGateResults: input.qualityGateResults,
      role: "reviewer",
      roleLabel: "AI 검수자",
    });
    const securityLines = formatImplementationQualityGateFailureLinesForTask({
      taskId: item.taskId,
      qualityGateResults: input.qualityGateResults,
      role: "security",
      roleLabel: "AI 보안관",
    });
    const qualityLines = [...reviewerLines, ...securityLines];
    if (!reworkLines.length && !qualityLines.length) return item;

    const section = [
      "## 재작업/보완 지시",
      "",
      ...(reworkLines.length ? ["- 사용자 재작업 요청:", ...reworkLines, ""] : []),
      ...(qualityLines.length ? ["- 검수/보안 실패 근거:", ...qualityLines] : []),
    ].join("\n");

    return { ...item, prompt: `${item.prompt}\n\n${section}` };
  });
}

export function formatCursorExecutionBlockedMessage(missing: readonly string[]): string {
  return [
    "아직 코드 에이전트 WIP 작업 요청을 진행할 수 없습니다.",
    "",
    "부족 항목:",
    ...missing.map((m) => `- ${m}`),
  ].join("\n");
}
