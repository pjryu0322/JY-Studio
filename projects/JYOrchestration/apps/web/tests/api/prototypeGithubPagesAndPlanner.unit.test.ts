import { describe, expect, it } from "vitest";
import { buildDeployPagesWorkflowYaml } from "@/lib/prototype/prototypeGithubPagesDeployService";
import { planPrototypeWorkUnitsFallback } from "@/lib/prototype/prototypePlannerService";

describe("prototypeGithubPagesDeployService", () => {
  it("embeds deploy branch in workflow YAML (not hardcoded main)", () => {
    const yml = buildDeployPagesWorkflowYaml("develop");
    expect(yml).toContain("develop");
    expect(yml).not.toMatch(/branches:\s*\n\s*-\s*"main"/);
  });

  it("quotes special branch names as JSON string in YAML", () => {
    const yml = buildDeployPagesWorkflowYaml(`feature/foo`);
    expect(yml).toContain(`"feature/foo"`);
  });
});

describe("prototypePlannerService fallback", () => {
  it("preserves deterministic fallback when LLM path is not used", () => {
    const input = {
      projectId: "p1",
      projectName: "Demo",
      projectDescription: "x".repeat(200),
      ideationSummary: "",
      actorFlowSummary: "a".repeat(100),
      selectedTemplate: "landing",
      featureDraftTitles: ["a", "b", "c"],
      promptSnapshot: "snap",
      repositoryStructureHint: "",
      userFeedback: "",
      previousWorkUnitsSummary: "",
    };
    const units = planPrototypeWorkUnitsFallback(input, "run-1");
    expect(units.length).toBeGreaterThanOrEqual(3);
    expect(units[0].order).toBe(1);
  });
});
