import { describe, expect, it } from "vitest";
import { INTEGRATION_WIRING_CODE_TASK_ID } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { INTEGRATION_FINAL_WIRING_WORK_BRANCH } from "@/lib/prototype/implementationIntegrationStep";
import {
  filterExecutableIntegrationMergeTargets,
  isExecutableCodeTaskExecutionUnit,
  isIntegrationOrchestrationExecutionUnit,
} from "@/lib/prototype/implementationExecutionUnitOrchestrationKind";
import { buildImplementationIntegrationCountSummary } from "@/lib/prototype/implementationIntegrationCountSummary";
import { evaluateIntegrationButtonGate } from "@/lib/prototype/implementationBoardIntegrationGate";

describe("buildImplementationIntegrationCountSummary", () => {
  it("separates 15 executable CodeTasks from 1 integration orchestration task", () => {
    const planTasks = [
      ...Array.from({ length: 15 }, (_, i) => ({
        codeTaskId: `CODE-${i + 1}`,
        parentTaskId: "T1",
        title: `Task ${i + 1}`,
        changeType: "feature" as const,
        description: "",
        branchPlan: { workBranch: `wip/feature/${i}` },
      })),
      {
        codeTaskId: INTEGRATION_WIRING_CODE_TASK_ID,
        parentTaskId: "DEV-INTEGRATION-001",
        title: "최종 연결/통합 Wiring",
        changeType: "integration" as const,
        description: "",
        branchPlan: { workBranch: INTEGRATION_FINAL_WIRING_WORK_BRANCH },
      },
    ];

    const summary = buildImplementationIntegrationCountSummary({
      boardSummary: {
        totalCount: 15,
        runnableCount: 0,
        integrationReadyCount: 15,
      },
      planTasks,
      executionUnits: [
        ...Array.from({ length: 15 }, (_, i) => ({
          unitId: `CODE-${i + 1}`,
          codeTaskId: `CODE-${i + 1}`,
          processTaskId: "T1",
          title: `Task ${i + 1}`,
          order: i,
          branchGroup: "feature" as const,
          baseBranch: "main",
          workBranch: `wip/feature/${i}`,
          dependencies: [],
          status: "verified" as const,
        })),
        {
          unitId: INTEGRATION_WIRING_CODE_TASK_ID,
          codeTaskId: INTEGRATION_WIRING_CODE_TASK_ID,
          processTaskId: "DEV-INTEGRATION-001",
          title: "최종 연결/통합 Wiring",
          order: 99,
          branchGroup: "integration" as const,
          baseBranch: "main",
          workBranch: INTEGRATION_FINAL_WIRING_WORK_BRANCH,
          dependencies: [],
          status: "pending" as const,
        },
      ],
    });

    expect(summary.executableCodeTaskCount).toBe(15);
    expect(summary.integrationTaskCount).toBe(1);
    expect(summary.totalOrchestrationUnitCount).toBe(16);
    expect(summary.integrationReadyCodeTaskCount).toBe(15);
    expect(summary.verifiedCodeTaskCount).toBe(15);
  });
});

describe("integration gate with 15+1 count model", () => {
  const countSummary = {
    executableCodeTaskCount: 15,
    integrationTaskCount: 1,
    totalOrchestrationUnitCount: 16,
    runnableCodeTaskCount: 0,
    completedCodeTaskCount: 15,
    verifiedCodeTaskCount: 15,
    integrationReadyCodeTaskCount: 15,
    countModel: "code_tasks_exclude_integration" as const,
  };

  it("allows integration when 15 CodeTasks are ready even if total orchestration count is 16", () => {
    const gate = evaluateIntegrationButtonGate({
      summary: {
        totalCount: 15,
        runnableCount: 0,
        integrationReadyCount: 15,
        selectedRunnableCount: 0,
        selectedRunnableCodeTaskIds: [],
        integrationReadyCodeTaskIds: Array.from({ length: 15 }, (_, i) => `CODE-${i + 1}`),
      },
      finalWiringReady: true,
      countSummary,
    });
    expect(gate.canRun).toBe(true);
  });

  it("does not block integration only because integrationReadyCount is less than totalOrchestrationUnitCount", () => {
    const gate = evaluateIntegrationButtonGate({
      summary: {
        totalCount: 15,
        runnableCount: 0,
        integrationReadyCount: 15,
        selectedRunnableCount: 0,
        selectedRunnableCodeTaskIds: [],
        integrationReadyCodeTaskIds: Array.from({ length: 15 }, (_, i) => `CODE-${i + 1}`),
      },
      finalWiringReady: true,
      countSummary,
    });
    expect(gate.canRun).toBe(true);
    expect(gate.blockReason).toBeNull();
  });
});

describe("filterExecutableIntegrationMergeTargets", () => {
  it("excludes integration-final-wiring from integration source branches", () => {
    const filtered = filterExecutableIntegrationMergeTargets([
      {
        codeTaskId: "CODE-1",
        workBranch: "wip/feature/core-flow",
      },
      {
        codeTaskId: INTEGRATION_WIRING_CODE_TASK_ID,
        workBranch: INTEGRATION_FINAL_WIRING_WORK_BRANCH,
      },
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.workBranch).toBe("wip/feature/core-flow");
  });
});

describe("execution unit orchestration kind", () => {
  it("classifies integration orchestration unit separately from executable CodeTask", () => {
    const integrationUnit = {
      unitId: INTEGRATION_WIRING_CODE_TASK_ID,
      codeTaskId: INTEGRATION_WIRING_CODE_TASK_ID,
      title: "Wiring",
      branchGroup: "integration" as const,
      workBranch: INTEGRATION_FINAL_WIRING_WORK_BRANCH,
    };
    const codeUnit = {
      unitId: "CODE-1",
      codeTaskId: "CODE-1",
      title: "Feature",
      branchGroup: "feature" as const,
      workBranch: "wip/feature/x",
    };
    expect(isIntegrationOrchestrationExecutionUnit(integrationUnit)).toBe(true);
    expect(isExecutableCodeTaskExecutionUnit(integrationUnit)).toBe(false);
    expect(isExecutableCodeTaskExecutionUnit(codeUnit)).toBe(true);
  });
});
