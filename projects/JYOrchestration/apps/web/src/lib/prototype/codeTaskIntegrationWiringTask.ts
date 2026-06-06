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
  "src/components/common/*",
  "src/features/*",
  "src/screens/*",
  "src/components/screens/*",
] as const;

const INTEGRATION_OWNED = mergeIntegrationWiringOwnedFiles([
  "app/index.html",
  "src/components/WorkspaceShell.*",
  "src/components/LeftPanel.*",
  "src/components/CenterPanel.*",
  "src/components/RightPanel.*",
  "src/styles/workspace.*",
  "src/styles/global.*",
  "src/App.*",
  "src/routes/*",
]);

export function isIntegrationWiringCodeTask(
  task: Pick<ImplementationCodeTaskV1, "codeTaskId" | "changeType" | "title">,
): boolean {
  if (task.codeTaskId === INTEGRATION_WIRING_CODE_TASK_ID) return true;
  if (task.changeType === "integration") return true;
  return /최종 연결|통합\s*wiring/i.test(task.title.trim());
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
      "screen/common/feature/data 결과물을 App Shell에 연결한다.",
      "필요한 import, props wiring, route/wrapper 연결을 수행한다.",
      "기존 WorkspaceShell/LeftPanel/CenterPanel/RightPanel 구조를 재작성하지 않고 연결 작업만 수행한다.",
      "생성된 screen component를 적절한 panel/slot에 배치한다.",
      "Loading/Error/Empty/Retry/Permission/Draft 공통 컴포넌트를 필요한 상태 흐름에 연결한다.",
      "샘플 데이터 provider를 화면 흐름에 연결한다.",
      "Preview 가능한 최종 화면 흐름을 완성한다.",
      "각 컴포넌트 내부 구현을 재작성하지 않는다.",
      "새로운 대형 레이아웃을 만들지 않는다.",
    ],
    verificationHints: [
      "App Shell 안에서 screen/common/feature/data 결과물이 연결되어 렌더링된다.",
      "Preview에서 입력 → 처리 중 → 결과 확인 흐름이 최소 샘플 데이터 기준으로 확인된다.",
      "기존 WorkspaceShell/Panel 구조가 재작성되지 않았다.",
      "각 screen/common/feature/data 컴포넌트 내부 구현이 재작성되지 않았다.",
      "import/props/wiring 변경이 필요한 파일에만 제한되어 있다.",
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
  return {
    ...input.plan,
    tasks,
    codeTaskCount: tasks.length,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeIntegrationTasksInPlan(
  plan: ImplementationCodeTaskPlanV1,
): ImplementationCodeTaskPlanV1 {
  const tasks = plan.tasks.map((t) => ensureIntegrationWiringCodeTask(t));
  return { ...plan, tasks, updatedAt: new Date().toISOString() };
}
