import { describe, expect, it } from "vitest";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  normalizeSelectedCodeTaskIds,
  sortCodeTaskIdsByImplementationPlanOrder,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";

const NOW = "2026-06-05T00:00:00.000Z";

function plan(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    tasks: [
      {
        codeTaskId: "CODE-DEV-FRAME-001-001",
        parentTaskId: "DEV-FRAME-001",
        title: "Frame",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
      },
      {
        codeTaskId: "CODE-DEV-FEATURE-001-001",
        parentTaskId: "DEV-FEATURE-001",
        title: "Feature",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
      },
      {
        codeTaskId: "CODE-DEV-COMMON-001-001",
        parentTaskId: "DEV-COMMON-001",
        title: "Common",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
      },
    ],
  };
}

describe("sortCodeTaskIdsByImplementationPlanOrder", () => {
  it("orders by plan.tasks index, not alphabetical id", () => {
    const p = plan();
    const shuffled = [
      "CODE-DEV-COMMON-001-001",
      "CODE-DEV-FEATURE-001-001",
      "CODE-DEV-FRAME-001-001",
    ];
    expect(sortCodeTaskIdsByImplementationPlanOrder(p, shuffled)).toEqual([
      "CODE-DEV-FRAME-001-001",
      "CODE-DEV-FEATURE-001-001",
      "CODE-DEV-COMMON-001-001",
    ]);
  });

  it("normalizeSelectedCodeTaskIds applies plan order", () => {
    const p = plan();
    const normalized = normalizeSelectedCodeTaskIds({
      codeTaskPlan: p,
      selectedCodeTaskIds: [
        "CODE-DEV-COMMON-001-001",
        "CODE-DEV-FRAME-001-001",
      ],
    });
    expect(normalized).toEqual([
      "CODE-DEV-FRAME-001-001",
      "CODE-DEV-COMMON-001-001",
    ]);
  });
});
