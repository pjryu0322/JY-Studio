import { CODE_TASK_FILE_BOUNDARY_VERSION } from "@/lib/prototype/codeTaskFileBoundary";
import type { CodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { normalizeCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundaryNormalize";
import { mergeIntegrationWiringOwnedFiles } from "@/lib/prototype/codeTaskRouteBoundaryPlanner";
import type {
  ImplementationCodeTaskPlanV1,
  ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export const INTEGRATION_WIRING_CODE_TASK_ID = "CODE-DEV-INTEGRATION-001-001" as const;
export const INTEGRATION_WIRING_PARENT_TASK_ID = "DEV-INTEGRATION-001" as const;
export const INTEGRATION_WIRING_PROCESS_TASK_TITLE = "최종 연결/통합 Wiring" as const;
export const INTEGRATION_WIRING_ROLE_TEXT =
  "foundation/data/common/feature/screen branch에서 생성된 컴포넌트, 상태, 샘플 데이터를 App Shell에 최종 연결하고 Preview 가능한 화면 흐름을 완성한다." as const;

const INTEGRATION_FORBIDDEN = [
  "src/data/sample/*",
  "src/data/sampleData.ts",
  "src/types/meeting.ts",
  "src/components/common/*",
  "src/features/*",
  "src/screens/*",
  "src/components/screens/*",
] as const;

const INTEGRATION_OWNED = mergeIntegrationWiringOwnedFiles([
  "app/index.html",
  "app/layout.*",
  "app/page.*",
  "pages/index.*",
  "src/App.*",
  "src/app/layout.*",
  "src/app/page.*",
  "src/components/WorkspaceShell.*",
  "src/components/LeftPanel.*",
  "src/components/CenterPanel.*",
  "src/components/RightPanel.*",
  "src/pages/index.*",
  "src/routes/*",
  "src/styles/workspace.*",
  "src/styles/global.*",
]);

export function isIntegrationWiringCodeTask(
  task: Pick<ImplementationCodeTaskV1, "codeTaskId" | "changeType" | "title">,
): boolean {
  if (task.codeTaskId === INTEGRATION_WIRING_CODE_TASK_ID) return true;
  if (task.changeType === "integration") return true;
  return /최종 연결|통합\s*wiring/i.test(String(task.title ?? "").trim());
}

export function integrationWiringFileBoundary(): CodeTaskFileBoundaryV1 {
  return normalizeCodeTaskFileBoundaryV1({
    version: CODE_TASK_FILE_BOUNDARY_VERSION,
    fileBoundaryConfidence: "high",
    conflictGroupId: "integration-wiring",
    expectedFiles: [...INTEGRATION_OWNED],
    ownedFiles: [...INTEGRATION_OWNED],
    forbiddenFiles: [...INTEGRATION_FORBIDDEN],
    forbiddenGlobs: [],
    sharedFiles: [],
  })!;
}

export function planHasIntegrationWiringCodeTask(
  tasks: readonly ImplementationCodeTaskV1[],
): boolean {
  return tasks.some((t) => isIntegrationWiringCodeTask(t));
}

/** Board·통합 gate·1단계 프롬프트 집계용 — integration orchestration 제외. */
export function listExecutableCodeTasksFromPlan(
  tasks: readonly ImplementationCodeTaskV1[],
): readonly ImplementationCodeTaskV1[] {
  return tasks.filter((t) => !isIntegrationWiringCodeTask(t));
}

export function findIntegrationOrchestrationCodeTask(
  tasks: readonly ImplementationCodeTaskV1[],
): ImplementationCodeTaskV1 | null {
  return tasks.find((t) => isIntegrationWiringCodeTask(t)) ?? null;
}

export function listIntegrationOrchestrationTasksFromPlan(
  tasks: readonly ImplementationCodeTaskV1[],
): readonly ImplementationCodeTaskV1[] {
  return tasks.filter((t) => isIntegrationWiringCodeTask(t));
}

export type CodeTaskPlanAggregateCountsV1 = Readonly<{
  readonly executableCodeTaskCount: number;
  readonly integrationOrchestrationTaskCount: number;
  readonly totalPlannedTaskCount: number;
}>;

/** Persisted `codeTaskCount` = executable only; total plan size = totalPlannedTaskCount. */
export function resolveCodeTaskPlanAggregateCounts(
  tasks: readonly ImplementationCodeTaskV1[],
): CodeTaskPlanAggregateCountsV1 {
  const executableCodeTaskCount = listExecutableCodeTasksFromPlan(tasks).length;
  const integrationOrchestrationTaskCount = listIntegrationOrchestrationTasksFromPlan(tasks).length;
  return {
    executableCodeTaskCount,
    integrationOrchestrationTaskCount,
    totalPlannedTaskCount: executableCodeTaskCount + integrationOrchestrationTaskCount,
  };
}

export function resolveIntegrationProcessTaskTitle(
  taskList?: ImplementationTaskListV1 | null,
): string {
  const fromList = taskList?.tasks?.find((t) => t.taskId === INTEGRATION_WIRING_PARENT_TASK_ID);
  if (fromList?.title?.trim()) return INTEGRATION_WIRING_PROCESS_TASK_TITLE;
  return INTEGRATION_WIRING_PROCESS_TASK_TITLE;
}

export function buildIntegrationWiringCodeTask(input: {
  readonly projectId: string;
  readonly dependsOnCodeTaskId: string | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
}): ImplementationCodeTaskV1 {
  const ready = input.envOk && input.designOk;
  const deps = input.dependsOnCodeTaskId?.trim() ? [input.dependsOnCodeTaskId.trim()] : [];
  return {
    codeTaskId: INTEGRATION_WIRING_CODE_TASK_ID,
    parentTaskId: INTEGRATION_WIRING_PARENT_TASK_ID,
    title: INTEGRATION_WIRING_PROCESS_TASK_TITLE,
    description: INTEGRATION_WIRING_ROLE_TEXT,
    changeType: "integration",
    targetHints: ["integration", "shell-wiring"],
    dependencies: deps,
    codeTaskDependencies: deps,
    acceptanceCriteria: [
      "foundation/data/common/feature/screen branch 산출물을 App Shell 및 패널 slot에 import/props로 연결한다.",
      "src/data/sampleData.ts의 sampleMeetingFiles를 회의 파일 영역에 연결한다.",
      "sampleParticipants를 참여자 영역에 연결한다.",
      "sampleTranscriptSegments를 중앙 작업 공간 또는 스크립트 영역에 연결한다.",
      "sampleMeetingSummary를 결과 패널 요약 영역에 연결한다.",
      "sampleDecisions를 결정사항 영역에 연결한다.",
      "sampleActionItems를 할 일 영역에 연결한다.",
      "sampleDraftTimeline을 초안 생성 타임라인 영역에 연결한다.",
      "기존 WorkspaceShell/LeftPanel/CenterPanel/RightPanel 구조를 재작성하지 않는다.",
      "regex 기반 임시 패치나 placeholder 교체 방식으로 연결하지 않는다.",
      "screen Task가 제공한 실제 화면형 컴포넌트를 App Shell의 적절한 panel/slot에 연결한다.",
      "screen Task 컴포넌트를 단순 placeholder wrapper로 대체하지 않는다.",
      "common/feature 산출물은 필요한 경우 props/callback으로 연결하되, 해당 산출물 내부를 재작성하지 않는다.",
      "동일 데이터를 패널별 mock으로 중복 작성하지 않는다.",
      "src/data/sampleData.ts를 단일 sample data source로 사용한다.",
      "Preview에서 실제 서비스 초기 화면처럼 보이는 것을 완료 기준으로 삼는다.",
    ],
    verificationHints: [
      "Preview에서 좌/중/우 패널이 모두 실제 샘플 데이터로 렌더링된다.",
      "회의 파일, 참여자, 스크립트, 요약, 결정사항, 할 일, 타임라인이 확인된다.",
      "placeholder-only 화면이 남아 있지 않다.",
      "빈 bullet, 깨진 필드명, undefined/null 표시가 없어야 한다.",
      "모바일 또는 좁은 화면에서 주요 영역이 겹치지 않는다.",
      "App Shell, screen, common, feature 산출물이 import/props 기반으로 연결된다.",
      "screen Task의 placeholder-only 금지 기준이 최종 Preview에서도 유지된다.",
      "common/feature 산출물이 import/props/callback 기반으로 연결되며 내부 구현이 재작성되지 않았다.",
      "sampleData는 수정하지 않고 읽어서 연결한다.",
      "build/lint/test 중 가능한 검증을 수행한다.",
    ],
    forbiddenPaths: ["package.json", "pnpm-lock.yaml"],
    priority: "P0",
    status: ready ? "ready" : "blocked",
    blockers: ready ? [] : ["실행환경 또는 디자인 준비 미완료"],
    fileBoundary: integrationWiringFileBoundary(),
  };
}

export function ensureIntegrationWiringCodeTask(
  task: ImplementationCodeTaskV1,
): ImplementationCodeTaskV1 {
  if (!isIntegrationWiringCodeTask(task)) return task;
  const canonical = buildIntegrationWiringCodeTask({
    projectId: "",
    dependsOnCodeTaskId: task.dependencies?.[task.dependencies.length - 1] ?? null,
    envOk: task.status !== "blocked",
    designOk: task.status !== "blocked",
  });
  return {
    ...canonical,
    branchPlan: task.branchPlan ?? canonical.branchPlan,
    codeTaskDependencies: task.codeTaskDependencies ?? canonical.codeTaskDependencies,
    dependencies: task.dependencies ?? canonical.dependencies,
    fileBoundary: integrationWiringFileBoundary(),
  };
}

export function appendIntegrationWiringCodeTaskToPlan(input: {
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly envOk?: boolean;
  readonly designOk?: boolean;
}): ImplementationCodeTaskPlanV1 {
  const tasks = input.plan.tasks
    .filter((t) => !isIntegrationWiringCodeTask(t))
    .map((t) => t);
  const dependsOn = tasks[tasks.length - 1]?.codeTaskId ?? null;
  const wiring = buildIntegrationWiringCodeTask({
    projectId: input.plan.projectId,
    dependsOnCodeTaskId: dependsOn,
    envOk: input.envOk ?? true,
    designOk: input.designOk ?? true,
  });
  tasks.push(wiring);
  const counts = resolveCodeTaskPlanAggregateCounts(tasks);
  return {
    ...input.plan,
    tasks,
    codeTaskCount: counts.executableCodeTaskCount,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeIntegrationTasksInPlan(
  plan: ImplementationCodeTaskPlanV1,
): ImplementationCodeTaskPlanV1 {
  const tasks = plan.tasks.map((t) => ensureIntegrationWiringCodeTask(t));
  return { ...plan, tasks, updatedAt: new Date().toISOString() };
}
