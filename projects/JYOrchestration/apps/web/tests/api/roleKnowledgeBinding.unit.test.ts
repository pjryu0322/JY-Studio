import { describe, expect, it } from "vitest";
import { resolveKnowledgeContextForRole } from "@/lib/platform-orchestration/knowledgeBinding";

describe("roleKnowledgeBinding", () => {
  it("resolves role, project, and member override knowledge packs without duplicates", () => {
    const resolved = resolveKnowledgeContextForRole({
      role: "developer",
      memberId: "ai-dev-egov",
      roleBindings: [
        { role: "developer", knowledgePackId: "kp-dev-standard", required: true },
      ],
      projectBindings: [
        {
          projectId: "p1",
          knowledgePackId: "kp-egov",
          appliesToRoles: ["developer"],
        },
      ],
      memberOverrides: [
        { memberId: "ai-dev-egov", knowledgePackId: "kp-egov" },
        { memberId: "ai-dev-egov", knowledgePackId: "kp-react" },
      ],
    });

    expect(resolved.knowledgePackIds).toEqual(["kp-dev-standard", "kp-egov", "kp-react"]);
    expect(resolved.sources.filter((s) => s.source === "role")).toHaveLength(1);
    expect(resolved.sources.filter((s) => s.source === "project")).toHaveLength(1);
    expect(resolved.sources.filter((s) => s.source === "member_override")).toHaveLength(1);
  });

  it("reports missing required role knowledge pack when binding has empty id", () => {
    const resolved = resolveKnowledgeContextForRole({
      role: "security",
      roleBindings: [
        { role: "security", knowledgePackId: "", required: true, reason: "OWASP required" },
      ],
    });

    expect(resolved.requiredMissingKnowledgePackIds.length).toBeGreaterThan(0);
    expect(resolved.knowledgePackIds).toEqual([]);
  });
});
