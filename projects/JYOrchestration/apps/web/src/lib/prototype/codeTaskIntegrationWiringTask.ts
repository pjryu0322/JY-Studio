import { CODE_TASK_FILE_BOUNDARY_VERSION } from "@/lib/prototype/codeTaskFileBoundary";
import type { CodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { WORKSPACE_SHELL_OWNED_PATTERNS } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import type {
  ImplementationCodeTaskPlanV1,
  ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export const INTEGRATION_WIRING_CODE_TASK_ID = "CODE-DEV-INTEGRATION-001-001" as const;
export const INTEGRATION_WIRING_PARENT_TASK_ID = "DEV-INTEGRATION-001" as const;

const COMMON_FORBIDDEN = [
  "src/data/sample/*",
  "src/components/common/*",
  "src/screens/*",
  "src/components/screens/*",
] as const;

export function integrationWiringFileBoundary(): CodeTaskFileBoundaryV1 {
  return {
    version: CODE_TASK_FILE_BOUNDARY_VERSION,
    fileBoundaryConfidence: "high",
    conflictGroupId: "integration-wiring",
    expectedFiles: [
      ...WORKSPACE_SHELL_OWNED_PATTERNS,
      "src/routes/*",
      "src/App.*",
    ],
    ownedFiles: [
      ...WORKSPACE_SHELL_OWNED_PATTERNS,
      "src/routes/*",
      "src/App.*",
    ],
    forbiddenFiles: [...COMMON_FORBIDDEN],
    forbiddenGlobs: [],
    sharedFiles: [],
  };
}

export function planHasIntegrationWiringCodeTask(
  tasks: readonly ImplementationCodeTaskV1[],
): boolean {
  return tasks.some(
    (t) =>
      t.codeTaskId === INTEGRATION_WIRING_CODE_TASK_ID ||
      t.branchPlan?.branchGroup === "integration" ||
      /integration|통합\s*wiring|최종 연결/i.test(t.title),
  );
}

function resolveIntegrationParentTaskId(input: {
  readonly tasks: readonly ImplementationCodeTaskV1[];
  readonly taskList?: ImplementationTaskListV1 | null;
}): string {
  const fromList = input.taskList?.tasks?.find((t) => t.taskId === INTEGRATION_WIRING_PARENT_TASK_ID);
  if (fromList) return INTEGRATION_WIRING_PARENT_TASK_ID;
  const screenTask = [...input.tasks].reverse().find((t) => t.branchPlan?.branchGroup === "screen");
  if (screenTask?.parentTaskId.trim()) return screenTask.parentTaskId.trim();
  const last = input.tasks[input.tasks.length - 1];
  return last?.parentTaskId.trim() || INTEGRATION_WIRING_PARENT_TASK_ID;
}

export function buildIntegrationWiringCodeTask(input: {
  readonly projectId: string;
  readonly parentTaskId: string;
  readonly dependsOnCodeTaskId: string | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
}): ImplementationCodeTaskV1 {
  const ready = input.envOk && input.designOk;
  const deps = input.dependsOnCodeTaskId?.trim() ? [input.dependsOnCodeTaskId.trim()] : [];
  return {
    codeTaskId: INTEGRATION_WIRING_CODE_TASK_ID,
    parentTaskId: input.parentTaskId,
    title: "최종 연결/통합 Wiring",
    description:
      "foundation/data/common/feature/screen branch에서 생성된 컴포넌트와 데이터를 App Shell에 최종 연결하고 Preview 가능한 화면 흐름을 완성한다.",
    changeType: "integration",
    targetHints: ["integration", "shell-wiring"],
    dependencies: deps,
    codeTaskDependencies: deps,
    acceptanceCriteria: [
      "screen/common/feature/data 결과물을 App Shell에 연결한다.",
      "필요한 import, props wiring, route/wrapper 연결을 수행한다.",
      "기존 Shell 구조를 보존하면서 연결 작업만 수행한다.",
      "Preview가 가능한 최종 화면 흐름을 만든다.",
    ],
    verificationHints: ["통합 branch에서 Preview 화면 흐름 확인", "Shell/global 파일 중복 수정 없음"],
    forbiddenPaths: ["package.json", "pnpm-lock.yaml"],
    priority: "P0",
    status: ready ? "ready" : "blocked",
    blockers: ready ? [] : ["실행환경 또는 디자인 준비 미완료"],
    fileBoundary: integrationWiringFileBoundary(),
  };
}

export function appendIntegrationWiringCodeTaskToPlan(input: {
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly envOk?: boolean;
  readonly designOk?: boolean;
}): ImplementationCodeTaskPlanV1 {
  if (planHasIntegrationWiringCodeTask(input.plan.tasks)) {
    return input.plan;
  }
  const tasks = [...input.plan.tasks];
  const dependsOn = tasks[tasks.length - 1]?.codeTaskId ?? null;
  const parentTaskId = resolveIntegrationParentTaskId({
    tasks,
    taskList: input.taskList ?? null,
  });
  const wiring = buildIntegrationWiringCodeTask({
    projectId: input.plan.projectId,
    parentTaskId,
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
