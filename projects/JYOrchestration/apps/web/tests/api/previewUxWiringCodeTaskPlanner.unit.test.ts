import { describe, expect, it } from "vitest";
import {
  CANONICAL_PREVIEW_UX_WIRING_CODE_TASK_ID,
  ensurePreviewUxWiringCodeTaskInPlan,
} from "@/lib/prototype/previewUxWiringCodeTaskPlanner";
import { SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/sampleDataCodeTaskPlanner";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

function minimalPlan(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    source: "implementation_task_list",
    parentTaskCount: 1,
    codeTaskCount: 1,
    readiness: { ready: true, missing: [] },
    tasks: [
      {
        codeTaskId: SAMPLE_DATA_CODE_TASK_ID,
        parentTaskId: "DEV-MOCK-001",
        title: "샘플 데이터",
        description: "",
        changeType: "data",
        targetHints: [],
        dependencies: [],
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        priority: "P0",
        status: "ready",
        blockers: [],
      },
    ],
  };
}

describe("previewUxWiringCodeTaskPlanner", () => {
  it("appends CODE-WIRING-PREVIEW-001 when sample data task exists", () => {
    const next = ensurePreviewUxWiringCodeTaskInPlan(minimalPlan());
    expect(next.tasks.some((t) => t.codeTaskId === CANONICAL_PREVIEW_UX_WIRING_CODE_TASK_ID)).toBe(
      true,
    );
  });
});
