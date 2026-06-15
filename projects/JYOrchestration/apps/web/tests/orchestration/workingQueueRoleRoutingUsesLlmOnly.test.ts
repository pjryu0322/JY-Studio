import { describe, expect, it } from "vitest";
import { resolveRoleOrchestrationFields } from "@/lib/prototype/implementationWorkingQueueRoleWorkflow";
import { workingQueueItemWorkflowLabel } from "@/lib/prototype/implementationWorkingQueueRoleLabels";
import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";

const baseItem = (overrides: Partial<ImplementationWorkingQueueItem> = {}): ImplementationWorkingQueueItem => ({
  id: "iwq-1",
  projectId: "p1",
  title: "t",
  description: "d",
  rawUserMessage: "d",
  affectedArea: "unknown",
  status: "pending",
  riskLevel: "medium",
  createdAt: "2026-06-15T00:00:00.000Z",
  updatedAt: "2026-06-15T00:00:00.000Z",
  ...overrides,
});

describe("workingQueueRoleRoutingUsesLlmOnly", () => {
  it("uses LLM designer workflow when primaryRole and reviewWorkflow are present", () => {
    const fields = resolveRoleOrchestrationFields({
      primaryRole: "designer",
      executionOwnerRole: "developer",
      reviewWorkflow: [
        { role: "designer", task: "ux_review", status: "pending" },
        { role: "developer", task: "developer_fix", status: "pending" },
      ],
    });
    expect(fields.roleRoutingSource).toBe("llm");
    expect(fields.primaryRole).toBe("designer");
    const label = workingQueueItemWorkflowLabel(
      baseItem({
        primaryRole: fields.primaryRole,
        reviewWorkflow: fields.reviewWorkflow,
        roleRoutingSource: fields.roleRoutingSource,
      }),
    );
    expect(label).toBe("디자이너 검토 → 개발자 반영");
  });

  it("uses LLM security workflow", () => {
    const fields = resolveRoleOrchestrationFields({
      primaryRole: "security",
      executionOwnerRole: "developer",
      reviewWorkflow: [
        { role: "security", task: "security_review", status: "pending" },
        { role: "developer", task: "developer_fix", status: "pending" },
      ],
    });
    expect(fields.roleRoutingSource).toBe("llm");
    expect(
      workingQueueItemWorkflowLabel(
        baseItem({ reviewWorkflow: fields.reviewWorkflow, roleRoutingSource: "llm" }),
      ),
    ).toBe("보안관 검토 → 개발자 반영");
  });

  it("uses LLM developer-only workflow", () => {
    const fields = resolveRoleOrchestrationFields({
      primaryRole: "developer",
      executionOwnerRole: "developer",
      reviewWorkflow: [{ role: "developer", task: "developer_fix", status: "pending" }],
    });
    expect(fields.roleRoutingSource).toBe("llm");
    expect(fields.reviewWorkflow).toHaveLength(1);
  });
});
