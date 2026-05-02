import { describe, expect, it } from "vitest";
import { getPrototypeDeployStatusSnapshot } from "@/lib/prototype/prototypeDeploySnapshot";
import { buildDeployPagesWorkflowYaml } from "@/lib/prototype/prototypeGithubPagesDeployService";
import { planPrototypeWorkUnitsFallback } from "@/lib/prototype/prototypePlannerService";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";

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

  it("adds SPA 404.html and disables Jekyll for GitHub Pages", () => {
    const yml = buildDeployPagesWorkflowYaml("main");
    expect(yml).toContain("dist/404.html");
    expect(yml).toContain("dist/.nojekyll");
  });

  it("falls back to npm install when package-lock.json is missing", () => {
    const yml = buildDeployPagesWorkflowYaml("main");
    expect(yml).toContain("npm install");
    expect(yml).toContain("npm ci");
  });
});

describe("getPrototypeDeployStatusSnapshot", () => {
  const base = (patch: Partial<PrototypeRun>): PrototypeRun =>
    ({
      id: "r1",
      projectId: "p1",
      selectedTemplate: "landing",
      promptSnapshot: "",
      prototypeIdeationSummary: null,
      prototypeActorFlowSummary: null,
      prototypeFeatureDraftTitlesJson: null,
      prototypeProjectDescription: null,
      runSchemaVersion: 2,
      workUnits: [],
      totalWorkUnits: 0,
      currentWorkUnitOrder: null,
      workUnitsExecutionConfirmed: true,
      plannerStatus: "DONE",
      plannerSource: null,
      plannerSummary: null,
      plannerError: null,
      branchName: null,
      cursorRunId: null,
      commitSha: null,
      changedFiles: [],
      status: "PREVIEW_READY",
      statusReason: null,
      aiReviewDecision: "PASS",
      aiReviewSummary: null,
      prUrl: null,
      prNumber: null,
      mergeSha: null,
      deploymentStatus: "PENDING",
      deploymentRequestedAt: null,
      deploymentStartedAt: null,
      deploymentEndedAt: null,
      resultUrl: null,
      suggestedPreviewUrl: "https://o.github.io/repo/",
      previewUrl: "https://o.github.io/repo/",
      pagesDeployWorkflowRunUrl: null,
      deployFailureDetail: null,
      pagesDeployTriggerCommitSha: null,
      publicUrl: null,
      createdAt: "",
      updatedAt: "",
      ...patch,
    }) as PrototypeRun;

  it("treats PREVIEW_READY without publicUrl as not deployed", () => {
    const s = getPrototypeDeployStatusSnapshot(base({ status: "PREVIEW_READY", publicUrl: null }));
    expect(s.deployStatus).toBe("NOT_DEPLOYED");
  });

  it("treats DONE + resultUrl as deployed even if publicUrl missing", () => {
    const s = getPrototypeDeployStatusSnapshot(
      base({ deploymentStatus: "DONE", resultUrl: "https://o.github.io/repo/", publicUrl: null }),
    );
    expect(s.deployStatus).toBe("DEPLOYED");
  });

  it("maps REQUESTED to deploying", () => {
    const s = getPrototypeDeployStatusSnapshot(base({ deploymentStatus: "REQUESTED" }));
    expect(s.deployStatus).toBe("DEPLOYING");
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
