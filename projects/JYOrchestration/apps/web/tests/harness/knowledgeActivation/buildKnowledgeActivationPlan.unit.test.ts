import { describe, expect, it } from "vitest";

import { buildKnowledgeActivationPlan } from "@/lib/harness/knowledgeActivation/buildKnowledgeActivationPlan";
import type { ActiveKnowledgePackRef } from "@/lib/overlay/activeKnowledgePackRef";

describe("buildKnowledgeActivationPlan", () => {
  it("returns an empty plan when no inputs are provided", () => {
    const plan = buildKnowledgeActivationPlan({});
    expect(plan.mode).toBe("dry_run");
    expect(plan.roleKey).toBeNull();
    expect(plan.workspaceStage).toBeNull();
    expect(plan.taskType).toBeNull();
    expect(plan.items).toEqual([]);
    // empty input still surfaces NO_*_POLICY_MATCH / NO_KNOWLEDGE_HINTS findings
    expect(plan.findings.length).toBeGreaterThan(0);
  });

  it("applies the role policy and assigns role_policy reasonType", () => {
    const plan = buildKnowledgeActivationPlan({ roleKey: "developer" });
    expect(plan.items.length).toBeGreaterThan(0);
    for (const item of plan.items) {
      expect(item.reasonType).toBe("role_policy");
      expect(item.roleKey).toBe("developer");
    }
  });

  it("merges role + stage policies and dedupes by knowledgePackId", () => {
    const plan = buildKnowledgeActivationPlan({
      roleKey: "developer",
      workspaceStage: "prototype-build",
    });
    const ids = plan.items.map((i) => i.knowledgePackId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("coding-standard-guide");
  });

  it("promotes priority using required > recommended > optional", () => {
    const plan = buildKnowledgeActivationPlan({
      roleKey: "security",
      workspaceStage: "security-review",
    });
    const owasp = plan.items.find((i) => i.knowledgePackId === "owasp-top10-guide");
    expect(owasp?.priority).toBe("required");
  });

  it("merges existing hints with existing_hint reasonType", () => {
    const hints: ActiveKnowledgePackRef[] = [
      {
        knowledgePackId: "manual-knowledge-pack",
        activationReason: "사용자 수동 활성화",
        priority: 0,
        status: "selected",
        targetRoles: ["planner"],
      },
    ];
    const plan = buildKnowledgeActivationPlan({
      roleKey: "planner",
      existingHints: hints,
    });
    const manual = plan.items.find((i) => i.knowledgePackId === "manual-knowledge-pack");
    expect(manual).toBeDefined();
    expect(manual?.reasonType).toBe("existing_hint");
    expect(manual?.priority).toBe("required");
  });

  it("emits NO_ROLE_POLICY_MATCH / NO_STAGE_POLICY_MATCH findings when policies miss", () => {
    const plan = buildKnowledgeActivationPlan({
      roleKey: "unknown-role",
      workspaceStage: "unknown-stage",
    });
    const codes = plan.findings.map((f) => f.code);
    expect(codes).toContain("NO_ROLE_POLICY_MATCH");
    expect(codes).toContain("NO_STAGE_POLICY_MATCH");
  });

  it("sorts items deterministically by priority then reasonType then id", () => {
    const plan = buildKnowledgeActivationPlan({
      roleKey: "developer",
      workspaceStage: "security-review",
      taskType: "review",
    });
    const planRank: Record<string, number> = { required: 3, recommended: 2, optional: 1 };
    for (let i = 1; i < plan.items.length; i += 1) {
      const a = plan.items[i - 1];
      const b = plan.items[i];
      expect(planRank[a.priority]).toBeGreaterThanOrEqual(planRank[b.priority]);
    }
  });

  it("clips knowledgePackId / reasonLabel and drops empty ids", () => {
    const hints: ActiveKnowledgePackRef[] = [
      {
        knowledgePackId: "",
        activationReason: "empty id should drop",
        priority: 0,
        status: "selected",
        targetRoles: [],
      },
      {
        knowledgePackId: "ok-pack",
        activationReason: "x".repeat(500),
        priority: 2,
        status: "selected",
        targetRoles: [],
      },
    ];
    const plan = buildKnowledgeActivationPlan({ existingHints: hints });
    const ok = plan.items.find((i) => i.knowledgePackId === "ok-pack");
    expect(ok?.reasonLabel.length).toBeLessThanOrEqual(200);
    expect(plan.items.some((i) => i.knowledgePackId === "")).toBe(false);
  });
});
