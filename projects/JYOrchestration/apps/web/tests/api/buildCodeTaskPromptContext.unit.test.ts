import { describe, expect, it } from "vitest";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import {
  buildImplementationCodeTaskPlanFromTaskList,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T00:00:00.000Z";
const PROJECT_ID = "p-ctx";

function taskList(): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: PROJECT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks: [
      {
        taskId: "DEV-1",
        title: "로그인 화면",
        description: "로그인 폼과 오류 표시",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        status: "ready",
        dependencies: [],
        acceptanceCriteria: ["로그인 성공", "오류 메시지 표시"],
        sourceRefs: [],
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

function seed(): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: PROJECT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    lifecycleStatus: "confirmed",
    readiness: { ready: true, missing: [] },
    templateContext: {
      templateId: "dashboard",
      templateNameKo: "대시보드",
      description: "운영자가 KPI를 확인하는 서비스",
      layoutContract: "사용자가 데이터 조회 문제를 해결",
      navigationItems: ["운영자", "관리자"],
      primarySections: ["KPI"],
    },
    processImplementationItems: [
      {
        id: "proc-1",
        processName: "로그인",
        actors: ["운영자"],
        steps: ["이메일 입력", "비밀번호 입력"],
        inputs: [],
        outputs: [],
        exceptions: [],
      },
    ],
    screenImplementationItems: [
      {
        id: "scr-1",
        screenName: "로그인",
        accessibleActors: ["운영자"],
        actions: ["제출"],
        visibleData: [],
        editableData: [],
        states: ["idle", "error"],
      },
    ],
    actorCapabilityMatrix: [
      {
        actor: "운영자",
        capabilities: ["조회"],
        restrictions: [],
        screens: ["로그인"],
        dataAccess: [],
      },
    ],
    commonDetailFeatures: [
      {
        name: "재시도",
        appliesTo: ["로그인"],
        description: "API 실패 시 재시도",
        required: true,
      },
    ],
    dataAndMockPolicy: [],
  } as ImplementationSeedV1;
}

describe("buildCodeTaskPromptContextMap", () => {
  it("creates one context per code task in the plan", () => {
    const list = taskList();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const map = buildCodeTaskPromptContextMap({
      projectId: PROJECT_ID,
      codeTaskPlan: plan,
      requirementsStateJson: {
        implementationSeedV1: seed(),
        implementationTaskListV1: list,
      },
      nowIso: NOW,
    });
    expect(Object.keys(map.contexts).length).toBe(plan.tasks.length);
    for (const ct of plan.tasks) {
      expect(map.contexts[ct.codeTaskId]?.codeTaskId).toBe(ct.codeTaskId);
      expect(map.contexts[ct.codeTaskId]?.parentTaskId).toBe(ct.parentTaskId);
    }
  });

  it("fills service goal from seed when planning artifacts exist", () => {
    const list = taskList();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const firstId = plan.tasks[0]!.codeTaskId;
    const map = buildCodeTaskPromptContextMap({
      projectId: PROJECT_ID,
      codeTaskPlan: plan,
      requirementsStateJson: { implementationSeedV1: seed(), implementationTaskListV1: list },
      nowIso: NOW,
    });
    const ctx = map.contexts[firstId]!;
    expect(ctx.planningContext.serviceGoal).toMatch(/KPI|대시보드/i);
    expect(ctx.flowContext.relatedActors).toContain("운영자");
    expect(ctx.flowContext.relatedUserFlows.join(" ")).toMatch(/로그인/i);
    expect(ctx.featureContext.relatedScreens.join(" ")).toMatch(/로그인/i);
    expect(ctx.featureContext.relatedFeatures.length).toBeLessThanOrEqual(8);
  });

  it("scopes retry task related features to retry not full catalog", () => {
    const list = taskList();
    const richSeed = {
      ...seed(),
      commonDetailFeatures: [
        { name: "재시도", appliesTo: ["로그인"], description: "재시도", required: true },
        { name: "로딩 상태", appliesTo: ["로그인"], description: "로딩", required: true },
        { name: "오류 메시지", appliesTo: ["로그인"], description: "오류", required: true },
      ],
    };
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const map = buildCodeTaskPromptContextMap({
      projectId: PROJECT_ID,
      codeTaskPlan: plan,
      requirementsStateJson: { implementationSeedV1: richSeed, implementationTaskListV1: list },
      nowIso: NOW,
    });
    const retryCtx = Object.values(map.contexts).find((c) =>
      /재시도/i.test(plan.tasks.find((t) => t.codeTaskId === c.codeTaskId)?.title ?? ""),
    );
    if (retryCtx) {
      expect(retryCtx.featureContext.relatedFeatures).toContain("재시도");
      expect(retryCtx.featureContext.relatedFeatures).not.toContain("로딩 상태");
      expect(retryCtx.featureContext.relatedStates.join(" ")).toMatch(/error|retry/i);
    }
  });

  it("records heuristic_fallback warnings when seed is missing", () => {
    const list = taskList();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const map = buildCodeTaskPromptContextMap({
      projectId: PROJECT_ID,
      codeTaskPlan: plan,
      requirementsStateJson: { implementationTaskListV1: list },
      nowIso: NOW,
    });
    const ctx = map.contexts[plan.tasks[0]!.codeTaskId]!;
    expect(ctx.source).toBe("heuristic_fallback");
    expect(ctx.quality.warnings).toContain("implementationSeedV1");
  });
});
