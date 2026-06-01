import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImplementationPlanningReadinessCard } from "@/components/requirements/ImplementationPlanningReadinessCard";
import { buildImplementationPlanningReadinessPatch } from "@/lib/prototype/implementationPlanningReadiness";
import { buildImplementationPlanningReadinessCardVM } from "@/lib/prototype/implementationPlanningReadinessUi";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-01T00:00:00.000Z";

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: "p-ui",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks: [
      {
        taskId: "DEV-SCREEN-001",
        title: "Screen 1",
        description: "d",
        taskType: "screen",
        ownerRole: "developer",
        priority: "medium",
        status: "ready",
        dependencies: [],
        acceptanceCriteria: [],
        sourceRefs: [],
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("ImplementationPlanningReadinessCard", () => {
  it("hides internal counts and llm label on default render", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: "p-ui",
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const vm = buildImplementationPlanningReadinessCardVM({
      codeTaskPlan: readiness.implementationCodeTaskPlanV1,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
      codeTaskQualityGate: readiness.implementationCodeTaskQualityGateV1,
      taskList: sampleTaskList(),
    })!;

    const html = renderToStaticMarkup(createElement(ImplementationPlanningReadinessCard, { vm }));

    expect(html).toContain("구현 준비");
    expect(html).toContain("상세 정보는 로그 탭의 실행 로그에서 확인할 수 있습니다.");

    // Must not expose internal operational labels on default collapsed render.
    expect(html).not.toContain("Process Task:");
    expect(html).not.toContain("CodeTask:");
    expect(html).not.toContain("WorkItem:");
    expect(html).not.toContain("Validation:");
    expect(html).not.toContain("Preflight:");
    expect(html).not.toContain("LLM Refinement");
    expect(html).not.toContain("위험 CodeTask");
    expect(html).not.toContain("CodeTask 실행 feedback");
  });
});

