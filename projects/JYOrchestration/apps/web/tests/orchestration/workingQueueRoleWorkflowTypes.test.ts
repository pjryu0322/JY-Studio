import { describe, expect, it } from "vitest";
import {
  defaultReviewWorkflowForPrimaryRole,
  parseImplementationWorkingQueueWorkflowSteps,
} from "@/lib/prototype/implementationWorkingQueueRoleWorkflow";

describe("workingQueueRoleWorkflowTypes", () => {
  it("parses workflow steps from JSON", () => {
    const steps = parseImplementationWorkingQueueWorkflowSteps([
      { role: "designer", task: "ux_review", status: "pending" },
      { role: "developer", task: "developer_fix", status: "pending" },
    ]);
    expect(steps).toHaveLength(2);
    expect(steps?.[0]?.role).toBe("designer");
  });

  it("builds designer then developer workflow template", () => {
    const wf = defaultReviewWorkflowForPrimaryRole("designer");
    expect(wf.map((s) => s.task)).toEqual(["ux_review", "developer_fix"]);
  });
});
