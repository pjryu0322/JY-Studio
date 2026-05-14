import { describe, expect, it } from "vitest";

import {
  coerceKnowledgeActivationMetadata,
  parseKnowledgeActivationPlanFromUnknown,
} from "@/lib/harness/knowledgeActivation/knowledgeActivationCoerce";

describe("parseKnowledgeActivationPlanFromUnknown", () => {
  it("rejects non-object / mode mismatch / null", () => {
    expect(parseKnowledgeActivationPlanFromUnknown(null)).toBeNull();
    expect(parseKnowledgeActivationPlanFromUnknown("string")).toBeNull();
    expect(parseKnowledgeActivationPlanFromUnknown({ mode: "apply" })).toBeNull();
  });

  it("accepts an empty dry_run plan", () => {
    const plan = parseKnowledgeActivationPlanFromUnknown({ mode: "dry_run" });
    expect(plan).not.toBeNull();
    expect(plan?.items).toEqual([]);
    expect(plan?.findings).toEqual([]);
    expect(plan?.roleKey).toBeNull();
  });

  it("drops invalid items but keeps valid ones", () => {
    const plan = parseKnowledgeActivationPlanFromUnknown({
      mode: "dry_run",
      roleKey: "developer",
      items: [
        { knowledgePackId: "", priority: "required", reasonType: "role_policy", reasonLabel: "empty id" },
        {
          knowledgePackId: "good-pack",
          priority: "recommended",
          reasonType: "role_policy",
          reasonLabel: "valid",
        },
        {
          knowledgePackId: "missing-reason-type",
          priority: "recommended",
          reasonType: "bogus",
          reasonLabel: "drop",
        },
      ],
    });
    expect(plan).not.toBeNull();
    expect(plan?.items.map((i) => i.knowledgePackId)).toEqual(["good-pack"]);
  });

  it("falls back to optional for invalid priority but keeps the item", () => {
    const plan = parseKnowledgeActivationPlanFromUnknown({
      mode: "dry_run",
      items: [
        {
          knowledgePackId: "pack-a",
          priority: "blocker",
          reasonType: "role_policy",
          reasonLabel: "label",
        },
      ],
    });
    expect(plan?.items[0]?.priority).toBe("optional");
  });

  it("truncates oversized items / findings arrays", () => {
    const items = Array.from({ length: 200 }).map((_, idx) => ({
      knowledgePackId: `pack-${idx}`,
      priority: "optional",
      reasonType: "role_policy",
      reasonLabel: "x",
    }));
    const findings = Array.from({ length: 100 }).map((_, idx) => ({
      code: `CODE_${idx}`,
      severity: "info",
      message: "msg",
    }));
    const plan = parseKnowledgeActivationPlanFromUnknown({
      mode: "dry_run",
      items,
      findings,
    });
    expect(plan?.items.length).toBeLessThanOrEqual(64);
    expect(plan?.findings.length).toBeLessThanOrEqual(16);
  });

  it("trims context fields and clips overly long reasonLabel", () => {
    const plan = parseKnowledgeActivationPlanFromUnknown({
      mode: "dry_run",
      roleKey: "   role-1  ",
      workspaceStage: "  stage-a ",
      taskType: " planning  ",
      items: [
        {
          knowledgePackId: "pack-1",
          priority: "required",
          reasonType: "role_policy",
          reasonLabel: "a".repeat(400),
          roleKey: "role-1",
        },
      ],
    });
    expect(plan?.roleKey).toBe("role-1");
    expect(plan?.workspaceStage).toBe("stage-a");
    expect(plan?.taskType).toBe("planning");
    expect((plan?.items[0]?.reasonLabel.length ?? 0)).toBeLessThanOrEqual(200);
  });
});

describe("coerceKnowledgeActivationMetadata", () => {
  it("returns empty object when row is null/undefined", () => {
    expect(coerceKnowledgeActivationMetadata(null)).toEqual({});
    expect(coerceKnowledgeActivationMetadata(undefined)).toEqual({});
  });

  it("returns empty object when knowledgeActivationPlan is missing", () => {
    expect(coerceKnowledgeActivationMetadata({})).toEqual({});
  });

  it("returns an empty object when plan mode is not dry_run", () => {
    expect(
      coerceKnowledgeActivationMetadata({
        knowledgeActivationPlan: { mode: "apply", items: [], findings: [] },
      })
    ).toEqual({});
  });

  it("returns the parsed plan when valid", () => {
    const result = coerceKnowledgeActivationMetadata({
      knowledgeActivationPlan: {
        mode: "dry_run",
        roleKey: "planner",
        items: [
          {
            knowledgePackId: "service-planning-guide",
            priority: "recommended",
            reasonType: "role_policy",
            reasonLabel: "역할 기준 후보",
          },
        ],
      },
    });
    expect(result.knowledgeActivationPlan?.items).toHaveLength(1);
    expect(result.knowledgeActivationPlan?.roleKey).toBe("planner");
  });
});
