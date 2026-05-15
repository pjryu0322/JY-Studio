import { describe, expect, it } from "vitest";

import { buildMessageExplainabilityViewModel } from "@/lib/harness/explainability/buildMessageExplainabilityViewModel";
import { checkMessageExplainabilityUserExposure } from "@/lib/harness/explainability/messageExplainabilityUserExposurePolicy";

describe("checkMessageExplainabilityUserExposure", () => {
  it("passes for typical explainability VM", () => {
    const vm = buildMessageExplainabilityViewModel({
      overlayExtract: {
        knowledgeActivationPlan: {
          mode: "dry_run",
          roleKey: "planner",
          workspaceStage: "requirements",
          taskType: null,
          items: [
            {
              knowledgePackId: "pack-a",
              priority: "recommended",
              reasonType: "role_policy",
              reasonLabel: "역할 정책",
            },
          ],
          findings: [],
        },
      },
    });
    const c = checkMessageExplainabilityUserExposure(vm);
    expect(c.ok).toBe(true);
    expect(c.violations).toEqual([]);
  });

  it("flags too many summary lines", () => {
    const vm = buildMessageExplainabilityViewModel({
      overlayExtract: {
        knowledgeActivationPlan: {
          mode: "dry_run",
          roleKey: "planner",
          workspaceStage: "requirements",
          taskType: null,
          items: [
            {
              knowledgePackId: "pack-a",
              priority: "recommended",
              reasonType: "role_policy",
              reasonLabel: "역할 정책",
            },
          ],
          findings: [],
        },
      },
    });
    const bad = {
      ...vm,
      summaryLines: ["a", "b", "c", "d", "e", "f"],
    };
    const c = checkMessageExplainabilityUserExposure(bad);
    expect(c.ok).toBe(false);
    expect(c.violations).toContain("summary_lines_over_limit");
  });
});
