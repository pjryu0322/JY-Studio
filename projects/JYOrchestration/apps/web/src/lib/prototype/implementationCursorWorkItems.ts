import {
  CURSOR_WORK_ITEM_MIN_QUALITY_SCORE,
  evaluateCursorWorkItemQuality,
  type CursorWorkItemQualityGate,
} from "@/lib/prototype/implementationCursorPromptQuality";
import { appendWipPolicyToCodeAgentPrompt } from "@/lib/prototype/codeAgentWipExecution";
import { buildTaskCursorWorkBranch } from "@/lib/prototype/taskCursorExecution";
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
import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type { CursorWorkItemQualityGate } from "@/lib/prototype/implementationCursorPromptQuality";

export type CursorWorkItemOriginStage = "planning" | "implementation";
export type CursorWorkItemRefinementStatus =
  | "draft"
  | "source_refined"
  | "preflight_passed"
  | "preflight_failed";

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
  objective?: string;
  expectedChange?: string;
  candidateFiles?: readonly string[];
  candidateFileHints?: readonly string[];
  acceptanceCriteria?: readonly string[];
  verificationHints?: readonly string[];
  allowedPathHints?: readonly string[];
  noCodeChangeEvidenceRequired?: boolean;
  originStage?: CursorWorkItemOriginStage;
  refinementStatus?: CursorWorkItemRefinementStatus;
  sourceRefinedAt?: string;
  parentTaskId?: string;
  codeTaskId?: string;
  parentTaskDependencies?: readonly string[];
  codeTaskDependencies?: readonly string[];
}>;

export function mergeCursorWorkItemsByTask(input: {
  readonly existingWorkItems: readonly CursorWorkItem[];
  readonly updatedWorkItems: readonly CursorWorkItem[];
  readonly taskId: string;
}): readonly CursorWorkItem[] {
  const taskId = input.taskId.trim();
  if (!taskId) return [...input.existingWorkItems];

  const updatedById = new Map(input.updatedWorkItems.map((item) => [item.id, item]));
  const preserved = input.existingWorkItems.filter((item) => item.taskId !== taskId);
  const existingSameTask = input.existingWorkItems.filter((item) => item.taskId === taskId);

  const mergedSameTask = existingSameTask.map((item) => updatedById.get(item.id) ?? item);
  const existingSameTaskIds = new Set(existingSameTask.map((item) => item.id));
  const appendedNew = input.updatedWorkItems.filter((item) => !existingSameTaskIds.has(item.id));

  const result = [...preserved, ...mergedSameTask, ...appendedNew];
  const deduped = new Map(result.map((item) => [item.id, item]));
  return [...deduped.values()];
}

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

function taskListPriorityToSortKey(p: ImplementationTaskV1["priority"] | string): number {
  const raw = String(p ?? "").trim().toLowerCase();
  if (raw === "high" || raw === "p1" || raw === "critical") return 0;
  if (raw === "medium" || raw === "p2") return 1;
  if (raw === "low" || raw === "p3") return 2;
  return 3;
}

export function compareImplementationTaskListPriority(
  a: ImplementationTaskV1["priority"] | string,
  b: ImplementationTaskV1["priority"] | string,
): number {
  return taskListPriorityToSortKey(a) - taskListPriorityToSortKey(b);
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

/**
 * Fallback 전용: TaskList developer Task → WorkItem 직접 생성.
 * 기본 경로는 ImplementationCodeTaskPlanV1 → buildCursorWorkItemsFromImplementationCodeTaskPlan() 를 사용한다.
 */
export function buildCursorWorkItemsFromImplementationTaskList(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly nowIso?: string;
  readonly originStage?: CursorWorkItemOriginStage;
  readonly projectArtifacts?: readonly import("@/lib/requirements/projectArtifactTypes").ProjectArtifact[];
}): readonly CursorWorkItem[] {
  const tasks = (input.taskList.tasks ?? [])
    .filter((t) => t.ownerRole === "developer" && t.status === "ready")
    .slice()
    .sort((a, b) => compareImplementationTaskListPriority(a.priority, b.priority));

  const now = input.nowIso ?? new Date().toISOString();
  const originStage = input.originStage ?? "planning";

  return tasks.flatMap((task, index) =>
    buildWorkItemDraftsForDeveloperTask({
      projectId: input.projectId,
      task,
      taskIndex: index,
      nowIso: now,
      originStage,
      projectArtifacts: input.projectArtifacts ?? [],
    }),
  );
}

export function buildCursorWorkItemsFromImplementationTaskListFallback(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly nowIso?: string;
  readonly originStage?: CursorWorkItemOriginStage;
  readonly projectArtifacts?: readonly import("@/lib/requirements/projectArtifactTypes").ProjectArtifact[];
  readonly taskId?: string;
}): Readonly<{
  readonly workItems: readonly CursorWorkItem[];
  readonly timelineEntry: RequirementsPromptTimelineEntry;
}> {
  const now = input.nowIso ?? new Date().toISOString();
  const workItems = buildCursorWorkItemsFromImplementationTaskList({
    projectId: input.projectId,
    taskList: input.taskList,
    nowIso: now,
    originStage: input.originStage ?? "implementation",
    projectArtifacts: input.projectArtifacts,
  }).filter((item) => !input.taskId || item.taskId === input.taskId);
  return {
    workItems,
    timelineEntry: buildImplementationExecutionLogTimelineEntry({
      action: "implementation_work_items_fallback_generated_from_task_list",
      orchestrationTraceGroup: "implementation_planning_readiness",
      fields: {
        projectId: input.projectId,
        mode: "fallback",
        source: "implementation_task_list",
        ...(input.taskId ? { taskId: input.taskId } : {}),
      },
      nowIso: now,
    }),
  };
}

function buildWorkItemDraftsForDeveloperTask(input: {
  readonly projectId: string;
  readonly task: ImplementationTaskV1;
  readonly taskIndex: number;
  readonly nowIso: string;
  readonly originStage: CursorWorkItemOriginStage;
  readonly projectArtifacts: readonly import("@/lib/requirements/projectArtifactTypes").ProjectArtifact[];
}): readonly CursorWorkItem[] {
  const { task } = input;
  const sourceArtifactTypes = taskListTaskToArtifactTypes(task);
  const executionHints = buildImplementationTaskExecutionHints({
    taskTitle: task.title,
    sourceArtifactTypes,
    projectArtifacts: input.projectArtifacts,
    targetRepoKind: "generated_project",
  });
  const acceptanceCriteria = task.acceptanceCriteria?.length
    ? [...task.acceptanceCriteria]
    : [`${task.title} 기능이 기획 범위 안에서 동작한다.`];
  const splitTargets = [
    ...executionHints.candidateComponents.slice(0, 3),
    ...(executionHints.candidateComponents.length
      ? []
      : executionHints.candidateFiles.filter((file) => !file.includes("**")).slice(0, 2)),
  ];
  const targets = splitTargets.length ? splitTargets : [`scope:${task.taskId}`];

  return targets.map((target, workItemIndex) => {
    const focusedTitle =
      targets.length > 1
        ? `[${task.taskId}] ${task.title} · ${target.split("/").pop() ?? target}`
        : `[${task.taskId}] ${task.title}`;
    const objective = `${task.title} — ${target} 관련 구현`;
    const expectedChange = String(task.description ?? "").trim() || `${task.title} 요구사항 반영`;
    const candidateFiles = target.startsWith("scope:") ? [] : [target];
    const candidateFileHints = [
      ...executionHints.candidateDirectories.slice(0, 3).map((dir) => `dir:${dir}`),
      ...(candidateFiles.length ? [] : executionHints.candidateFiles.slice(0, 4)),
    ];
    const verificationHints = [
      ...executionHints.manualVerification.slice(0, 2),
      ...executionHints.testCommands.slice(0, 2),
    ];
    const workBranch = buildTaskCursorWorkBranch(task.taskId);
    const prompt = buildCursorPromptDraft({
      title: focusedTitle,
      taskId: task.taskId,
      workBranch,
      description: [
        "기획단계에서 생성된 Implementation Task List 기준 작업입니다.",
        "",
        `작업 ID: ${task.taskId}`,
        `목표: ${objective}`,
        `변경 내용: ${expectedChange}`,
        "",
        `설명: ${String(task.description ?? "").trim() || task.title}`,
        "",
        "완료 기준:",
        ...acceptanceCriteria.map((a) => `- ${a}`),
      ].join("\n"),
      artifactLabels: sourceArtifactTypes,
      acceptanceCriteria,
      securityChecks: [],
      reviewChecks: [],
      executionHints,
    });

    const draft: CursorWorkItem = {
      id: `cursor-wi-tasklist-${input.taskIndex + 1}-${workItemIndex + 1}-${task.taskId}`,
      taskId: task.taskId,
      title: focusedTitle,
      prompt,
      requiredFilesHint: [
        `taskList:${input.projectId}`,
        `task:${task.taskId}`,
        ...candidateFiles,
        ...candidateFileHints.slice(0, 4),
      ],
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
      objective,
      expectedChange,
      ...(candidateFiles.length ? { candidateFiles } : {}),
      ...(candidateFileHints.length ? { candidateFileHints } : {}),
      acceptanceCriteria,
      verificationHints,
      allowedPathHints: executionHints.candidateDirectories.slice(0, 4),
      noCodeChangeEvidenceRequired: true,
      originStage: input.originStage,
      refinementStatus: "draft",
    };
    return { ...draft, qualityGate: evaluateCursorWorkItemQuality(draft) };
  });
}

export function buildCursorWorkItemsFromImplementationCodeTaskPlan(input: {
  readonly projectId: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly nowIso?: string;
  readonly originStage?: CursorWorkItemOriginStage;
}): readonly CursorWorkItem[] {
  const now = input.nowIso ?? new Date().toISOString();
  const originStage = input.originStage ?? "planning";
  return input.codeTaskPlan.tasks.map((codeTask, index) =>
    buildCursorWorkItemFromCodeTask({
      projectId: input.projectId,
      codeTask,
      index,
      nowIso: now,
      originStage,
    }),
  );
}

function buildCursorWorkItemFromCodeTask(input: {
  readonly projectId: string;
  readonly codeTask: ImplementationCodeTaskV1;
  readonly index: number;
  readonly nowIso: string;
  readonly originStage: CursorWorkItemOriginStage;
}): CursorWorkItem {
  const { codeTask } = input;
  const parentTaskId = codeTask.parentTaskId;
  const acceptanceCriteria = codeTask.acceptanceCriteria.length
    ? [...codeTask.acceptanceCriteria]
    : [`${codeTask.title} 완료`];
  const candidateFiles = codeTask.candidateFiles ? [...codeTask.candidateFiles] : [];
  let candidateFileHints = codeTask.candidateFileHints ? [...codeTask.candidateFileHints] : [];
  if (!candidateFileHints.length && !candidateFiles.length) {
    candidateFileHints = (codeTask.targetHints ?? [])
      .slice(0, 4)
      .map((hint) => (hint.startsWith("dir:") ? hint : `dir:apps/web/src/${hint}`));
  }
  const verificationHints = codeTask.verificationHints.length
    ? [...codeTask.verificationHints]
    : ["pnpm test"];
  const parentTaskDependencies = codeTask.parentTaskDependencies ?? [];
  const codeTaskDependencies = codeTask.codeTaskDependencies ?? [];
  const dependencyLines = [
    "",
    "의존성:",
    ...(parentTaskDependencies.length
      ? ["Parent Task Dependencies:", ...parentTaskDependencies.map((dep) => `- ${dep}`)]
      : ["Parent Task Dependencies: (없음)"]),
    ...(codeTaskDependencies.length
      ? ["Code Task Dependencies:", ...codeTaskDependencies.map((dep) => `- ${dep}`)]
      : ["Code Task Dependencies: (없음)"]),
  ];
  const workBranch = buildTaskCursorWorkBranch(parentTaskId);
  const prompt = buildCursorPromptDraft({
    title: codeTask.title,
    taskId: parentTaskId,
    workBranch,
    description: [
      "기획단계 CodeTaskPlan 기준 작업입니다.",
      "",
      `CodeTask: ${codeTask.codeTaskId}`,
      `Parent Task: ${parentTaskId}`,
      `변경 유형: ${codeTask.changeType}`,
      "",
      codeTask.description,
      ...(codeTask.llmRationale?.trim()
        ? ["", `구현 요약: ${codeTask.llmRationale.trim().slice(0, 200)}`]
        : []),
      ...dependencyLines,
      "",
      "완료 기준:",
      ...acceptanceCriteria.map((item) => `- ${item}`),
    ].join("\n"),
    artifactLabels: [],
    acceptanceCriteria,
    securityChecks: [],
    reviewChecks: [],
    executionHints: {
      candidateFiles,
      candidateDirectories: candidateFileHints
        .filter((hint) => hint.startsWith("dir:"))
        .map((hint) => hint.slice(4)),
      candidateApiRoutes: codeTask.changeType === "api" ? candidateFiles : [],
      candidateComponents: codeTask.changeType === "component" ? candidateFiles : [],
      candidateTests: codeTask.changeType === "test" ? verificationHints : [],
      testCommands: verificationHints.filter((hint) => hint.includes("test") || hint.includes("pnpm")),
      manualVerification: verificationHints,
      forbiddenPaths: [...codeTask.forbiddenPaths],
      expectedBehavior: [`${codeTask.title} 완료 기준을 충족한다.`],
      regressionScope: ["기존 Stage1/ENV_TEST/Cursor 실행 파이프라인 회귀 없음"],
    },
  });

  const draft: CursorWorkItem = {
    id: `cursor-wi-${codeTask.codeTaskId}`,
    taskId: parentTaskId,
    parentTaskId,
    codeTaskId: codeTask.codeTaskId,
    title: codeTask.title,
    prompt,
    requiredFilesHint: [
      `taskList:${input.projectId}`,
      `task:${parentTaskId}`,
      `codeTask:${codeTask.codeTaskId}`,
      ...candidateFiles,
      ...candidateFileHints.slice(0, 4),
    ],
    expectedOutput: [
      "변경된 소스 파일 목록",
      "실행한 테스트 명령과 결과 요약",
      "핵심 동작 검증 요약",
      "미해결 이슈(있을 경우)",
    ],
    testCommands: verificationHints.filter((hint) => hint.startsWith("pnpm") || hint.includes("test")),
    forbiddenPaths: codeTask.forbiddenPaths.length ? codeTask.forbiddenPaths : COMMON_FORBIDDEN_PATHS,
    blocked: false,
    blockers: [],
    qualityGate: { promptReady: false, missing: [], score: 0 },
    objective: codeTask.title,
    expectedChange: codeTask.description.split("\n")[0]?.trim() || codeTask.title,
    ...(candidateFiles.length ? { candidateFiles } : {}),
    ...(candidateFileHints.length ? { candidateFileHints } : {}),
    acceptanceCriteria,
    verificationHints,
    noCodeChangeEvidenceRequired: true,
    originStage: input.originStage,
    refinementStatus: "draft",
    ...(parentTaskDependencies.length ? { parentTaskDependencies } : {}),
    ...(codeTaskDependencies.length ? { codeTaskDependencies } : {}),
  };
  return { ...draft, qualityGate: evaluateCursorWorkItemQuality(draft) };
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
    prompt: appendWipPolicyToCodeAgentPrompt(item.cursorPromptDraft, "cursor", {
      taskId: item.id,
      workBranch: buildTaskCursorWorkBranch(item.id),
    }),
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
    objective: item.title,
    expectedChange: item.description?.trim() || item.title,
    candidateFiles: h.candidateFiles.slice(0, 6),
    candidateFileHints: h.candidateDirectories.slice(0, 4).map((dir) => `dir:${dir}`),
    acceptanceCriteria: item.acceptanceCriteria?.length ? [...item.acceptanceCriteria] : [],
    verificationHints: [...h.manualVerification.slice(0, 2), ...h.testCommands.slice(0, 2)],
    allowedPathHints: h.candidateDirectories.slice(0, 4),
    noCodeChangeEvidenceRequired: true,
    originStage: "planning",
    refinementStatus: "draft",
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
