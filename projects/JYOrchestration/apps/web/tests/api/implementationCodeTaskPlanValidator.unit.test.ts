import { describe, expect, it } from "vitest";
import {
  buildImplementationCodeTaskPlanFromTaskList,
  type ImplementationCodeTaskPlanV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import { validateImplementationCodeTaskPlan } from "@/lib/prototype/implementationCodeTaskPlanValidator";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-28T12:00:00.000Z";
const PROJECT_ID = "p-validator";

function developerTask(taskId: string): ImplementationTaskV1 {
  return {
    taskId,
    title: taskId,
    description: taskId,
    taskType: "screen",
    ownerRole: "developer",
    priority: "medium",
    status: "ready",
    dependencies: [],
    acceptanceCriteria: [`${taskId} 완료`],
    sourceRefs: [],
  };
}

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: PROJECT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks: [developerTask("DEV-SCREEN-001")],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

function validPlan(): ImplementationCodeTaskPlanV1 {
  return buildImplementationCodeTaskPlanFromTaskList({
    projectId: PROJECT_ID,
    taskList: sampleTaskList(),
    envOk: true,
    designOk: true,
    nowIso: NOW,
  });
}

describe("validateImplementationCodeTaskPlan", () => {
  it("passes a valid heuristic plan", () => {
    const report = validateImplementationCodeTaskPlan({
      plan: validPlan(),
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    expect(report.status).toBe("passed");
    expect(report.errors).toEqual([]);
  });

  it("fails when parentTaskId is unknown", () => {
    const plan = validPlan();
    const mutated: ImplementationCodeTaskPlanV1 = {
      ...plan,
      tasks: plan.tasks.map((task, index) =>
        index === 0 ? { ...task, parentTaskId: "UNKNOWN-PARENT" } : task,
      ),
    };
    const report = validateImplementationCodeTaskPlan({
      plan: mutated,
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    expect(report.status).toBe("failed");
    expect(report.errors.some((error) => error.includes("unknown parentTaskId"))).toBe(true);
  });

  it("fails when codeTaskDependency is unknown", () => {
    const plan = validPlan();
    const mutated: ImplementationCodeTaskPlanV1 = {
      ...plan,
      tasks: plan.tasks.map((task, index) =>
        index === 0 ? { ...task, codeTaskDependencies: ["CODE-MISSING-001"] } : task,
      ),
    };
    const report = validateImplementationCodeTaskPlan({
      plan: mutated,
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    expect(report.status).toBe("failed");
    expect(report.errors.some((error) => error.includes("unknown codeTaskDependency"))).toBe(true);
  });

  it("fails on self dependency", () => {
    const plan = validPlan();
    const first = plan.tasks[0]!;
    const mutated: ImplementationCodeTaskPlanV1 = {
      ...plan,
      tasks: [
        {
          ...first,
          codeTaskDependencies: [first.codeTaskId],
          dependencies: [...(first.dependencies ?? []), first.codeTaskId],
        },
        ...plan.tasks.slice(1),
      ],
    };
    const report = validateImplementationCodeTaskPlan({
      plan: mutated,
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    expect(report.status).toBe("failed");
    expect(report.errors.some((error) => error.includes("self dependency"))).toBe(true);
  });

  it("fails when acceptanceCriteria is missing", () => {
    const plan = validPlan();
    const mutated: ImplementationCodeTaskPlanV1 = {
      ...plan,
      tasks: plan.tasks.map((task, index) =>
        index === 0 ? { ...task, acceptanceCriteria: [] } : task,
      ),
    };
    const report = validateImplementationCodeTaskPlan({
      plan: mutated,
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    expect(report.status).toBe("failed");
    expect(report.errors.some((error) => error.includes("acceptanceCriteria"))).toBe(true);
  });
});
