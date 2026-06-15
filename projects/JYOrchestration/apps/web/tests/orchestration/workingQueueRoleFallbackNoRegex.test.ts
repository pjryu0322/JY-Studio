import { describe, expect, it } from "vitest";
import { resolveRoleOrchestrationFields } from "@/lib/prototype/implementationWorkingQueueRoleWorkflow";

describe("workingQueueRoleFallbackNoRegex", () => {
  it("uses developer fallback for UX keywords when LLM role is missing", () => {
    const fields = resolveRoleOrchestrationFields({});
    expect(fields.primaryRole).toBe("developer");
    expect(fields.reviewWorkflow).toEqual([{ role: "developer", task: "developer_fix", status: "pending" }]);
    expect(fields.roleRoutingSource).toBe("fallback");
  });

  it("does not infer designer from title/진하게 text without LLM workflow", () => {
    const fields = resolveRoleOrchestrationFields({
      primaryRole: undefined,
      reviewWorkflow: undefined,
      roleReviewSummary: "회의파일, 참여자 타이틀을 진하게 해줘",
    });
    expect(fields.primaryRole).toBe("developer");
    expect(fields.roleRoutingSource).toBe("fallback");
  });

  it("does not infer security from 권한 text without LLM workflow", () => {
    const fields = resolveRoleOrchestrationFields({
      roleReviewSummary: "회의 녹취파일은 권한이 있는 사용자만 볼 수 있게",
    });
    expect(fields.primaryRole).toBe("developer");
    expect(fields.roleRoutingSource).toBe("fallback");
  });

  it("does not infer developer from API/데이터 keywords alone", () => {
    const fields = resolveRoleOrchestrationFields({
      roleReviewSummary: "녹취파일별 참여자 정보를 저장하고 API로 불러오기",
    });
    expect(fields.primaryRole).toBe("developer");
    expect(fields.roleRoutingSource).toBe("fallback");
  });

  it("falls back when only primaryRole is set without workflow", () => {
    const fields = resolveRoleOrchestrationFields({
      primaryRole: "designer",
      reviewWorkflow: undefined,
    });
    expect(fields.primaryRole).toBe("developer");
    expect(fields.roleRoutingSource).toBe("fallback");
  });
});
