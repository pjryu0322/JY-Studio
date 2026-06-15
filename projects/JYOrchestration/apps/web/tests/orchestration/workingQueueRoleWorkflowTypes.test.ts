import { describe, expect, it } from "vitest";
import {
  defaultReviewWorkflowForPrimaryRole,
  parseImplementationWorkingQueueWorkflowSteps,
  resolveRoleOrchestrationFields,
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

  it("builds designer then developer workflow", () => {
    const wf = defaultReviewWorkflowForPrimaryRole("designer");
    expect(wf.map((s) => s.task)).toEqual(["ux_review", "developer_fix"]);
  });
});

describe("previewFeedbackRoleRouting", () => {
  it("routes UX typography request to designer review", () => {
    const fields = resolveRoleOrchestrationFields({
      affectedArea: "ui",
      description: "회의파일, 참여자 타이틀을 진하게",
      desiredBehavior: "타이틀 굵게",
    });
    expect(fields.primaryRole).toBe("designer");
    expect(fields.reviewWorkflow.map((s) => s.task)).toEqual(["ux_review", "developer_fix"]);
  });

  it("routes list/IA request to designer workflow", () => {
    const fields = resolveRoleOrchestrationFields({
      affectedArea: "flow",
      description: "녹취파일을 목록으로 만들고 참여자 정보 관리",
    });
    expect(fields.primaryRole).toBe("designer");
  });

  it("routes data persistence to developer fix only", () => {
    const fields = resolveRoleOrchestrationFields({
      affectedArea: "data",
      description: "녹취파일별 참여자 정보를 저장하고 불러올 수 있게",
    });
    expect(fields.primaryRole).toBe("developer");
    expect(fields.reviewWorkflow).toEqual([{ role: "developer", task: "developer_fix", status: "pending" }]);
  });

  it("routes permission request to security review", () => {
    const fields = resolveRoleOrchestrationFields({
      affectedArea: "feature",
      description: "회의 녹취파일은 권한이 있는 사용자만 볼 수 있게",
    });
    expect(fields.primaryRole).toBe("security");
    expect(fields.reviewWorkflow.map((s) => s.task)).toEqual(["security_review", "developer_fix"]);
  });
});
