import { describe, expect, it } from "vitest";
import { buildFileBoundaryForRole } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import {
  buildIntegrationWiringCodeTask,
  INTEGRATION_WIRING_CODE_TASK_ID,
  INTEGRATION_WIRING_PARENT_TASK_ID,
  INTEGRATION_WIRING_PROCESS_TASK_TITLE,
  integrationWiringFileBoundary,
} from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { normalizeFileBoundaryPaths } from "@/lib/prototype/fileBoundaryNormalizer";
import { evaluateIntegrationWiringTaskContent } from "@/lib/prototype/integrationWiringContentValidation";
import { evaluateCommonBoundarySpecificity } from "@/lib/prototype/codeTaskCommonBoundaryValidation";
import { resolveCodeTaskSpecificRole } from "@/lib/prototype/codeTaskPromptRoleResolver";
import { formatCodeTaskPromptDraftBundle } from "@/lib/prototype/formatCodeTaskPromptDraft";
import {
  buildImplementationCodeTaskPlanFromTaskList,
} from "@/lib/prototype/implementationCodeTaskPlan";
import { prepareCodeTaskPlanForStageOnePrompt } from "@/lib/prototype/prepareCodeTaskPlanForStageOnePrompt";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T20:00:00.000Z";
const PID = "p-m49";

function meetingTaskList(): ImplementationTaskListV1 {
  const tasks = [
    { taskId: "DEV-FRAME-001", title: "화면 프레임/앱 Shell 구성", taskType: "feature" as const },
    { taskId: "DEV-MOCK-001", title: "샘플 데이터 생성", taskType: "feature" as const },
    { taskId: "DEV-COMMON-001", title: "로딩 상태 공통 기능 구현", taskType: "feature" as const },
    { taskId: "DEV-COMMON-002", title: "오류 메시지 공통 기능 구현", taskType: "feature" as const },
    { taskId: "DEV-SCREEN-003", title: "관리 화면 화면 구현", taskType: "screen" as const },
  ].map((t) => ({
    ...t,
    description: t.title,
    ownerRole: "developer" as const,
    priority: "high" as const,
    status: "ready" as const,
    dependencies: [],
    acceptanceCriteria: ["a", "b", "c"],
    sourceRefs: [],
  }));
  return {
    version: 1,
    projectId: PID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks,
    roleSummary: { developer: tasks.length, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("P3-M49 integration wiring task", () => {
  it("uses fixed parent task id and final wiring role", () => {
    const task = buildIntegrationWiringCodeTask({
      projectId: PID,
      dependsOnCodeTaskId: "X",
      envOk: true,
      designOk: true,
    });
    expect(task.parentTaskId).toBe(INTEGRATION_WIRING_PARENT_TASK_ID);
    expect(task.title).toBe(INTEGRATION_WIRING_PROCESS_TASK_TITLE);
    const role = resolveCodeTaskSpecificRole({
      codeTaskTitle: task.title,
      codeTaskDescription: task.description,
      changeType: task.changeType,
      parentTaskTitle: "관리 화면 화면 구현",
    });
    expect(role.roleKind).toBe("integration_wiring");
    expect(role.role).toContain("App Shell에 최종 연결");
    expect(role.role).not.toContain("전체 IA");
  });

  it("rejects shell reuse in integration content validation", () => {
    const bad = {
      ...buildIntegrationWiringCodeTask({
        projectId: PID,
        dependsOnCodeTaskId: "X",
        envOk: true,
        designOk: true,
      }),
      acceptanceCriteria: ["반응형 3열 workspace shell/container를 구현한다."],
    };
    const result = evaluateIntegrationWiringTaskContent({
      codeTask: bad,
      processTaskTitle: INTEGRATION_WIRING_PROCESS_TASK_TITLE,
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("integration_task_requirements_reused_shell_task");
  });

  it("passes final wiring validation for canonical task", () => {
    const task = buildIntegrationWiringCodeTask({
      projectId: PID,
      dependsOnCodeTaskId: "X",
      envOk: true,
      designOk: true,
    });
    const result = evaluateIntegrationWiringTaskContent({
      codeTask: task,
      processTaskTitle: INTEGRATION_WIRING_PROCESS_TASK_TITLE,
    });
    expect(result.ok).toBe(true);
  });

  it("deduplicates integration file boundary paths", () => {
    const boundary = integrationWiringFileBoundary();
    expect(boundary.ownedFiles.length).toBe(
      normalizeFileBoundaryPaths(boundary.ownedFiles).length,
    );
    expect(boundary.forbiddenFiles).toContain("src/features/*");
  });
});

describe("P3-M49 common file boundaries", () => {
  it("narrows owned files per common role", () => {
    const loading = buildFileBoundaryForRole("common_loading", {
      codeTaskId: "CODE-DEV-COMMON-001-001",
      title: "로딩",
    });
    const error = buildFileBoundaryForRole("common_error", {
      codeTaskId: "CODE-DEV-COMMON-002-001",
      title: "오류",
    });
    expect(loading.ownedFiles.join(" ")).toMatch(/LoadingState/);
    expect(loading.ownedFiles.join(" ")).not.toMatch(/ErrorMessage/);
    expect(error.ownedFiles.join(" ")).toMatch(/ErrorMessage/);
    expect(loading.ownedFiles).not.toEqual(error.ownedFiles);
    expect(evaluateCommonBoundarySpecificity({ codeTask: { ...loadingTask(), fileBoundary: loading } }).missing).toEqual([]);
  });
});

function loadingTask() {
  return {
    codeTaskId: "CODE-DEV-COMMON-001-001",
    parentTaskId: "DEV-COMMON-001",
    title: "로딩",
    description: "",
    changeType: "component" as const,
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    priority: "P1" as const,
    status: "ready" as const,
    blockers: [],
  };
}

describe("P3-M49 stage-one prompt output", () => {
  it("shows integration process task title in bundle", () => {
    const list = meetingTaskList();
    const prepared = prepareCodeTaskPlanForStageOnePrompt({
      projectId: PID,
      baseBranch: "main",
      plan: buildImplementationCodeTaskPlanFromTaskList({
        projectId: PID,
        taskList: list,
        envOk: true,
        designOk: true,
        nowIso: NOW,
      }),
      taskList: list,
      nowIso: NOW,
    });
    const integration = prepared.plan.tasks.find((t) => t.codeTaskId === INTEGRATION_WIRING_CODE_TASK_ID)!;
    const bundle = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: prepared.plan,
      taskList: list,
      promptContextMap: null,
    });
    expect(bundle).toContain(`Process Task: ${INTEGRATION_WIRING_PROCESS_TASK_TITLE}`);
    const integrationSection = bundle.split("### 6. 최종 연결/통합 Wiring")[1]?.split("### ")[0] ?? "";
    expect(integrationSection).toContain(`Process Task: ${INTEGRATION_WIRING_PROCESS_TASK_TITLE}`);
    expect(integrationSection).not.toContain("Process Task: 관리 화면 화면 구현");
    expect(integrationSection).not.toContain("반응형 3열 workspace shell/container를 구현한다");
    expect(integration.parentTaskId).toBe(INTEGRATION_WIRING_PARENT_TASK_ID);
  });
});
