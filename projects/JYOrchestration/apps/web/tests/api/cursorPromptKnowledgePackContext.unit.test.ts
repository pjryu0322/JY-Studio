import { describe, expect, it } from "vitest";
import { buildCursorExecutionPrompt } from "@/lib/execution/buildCursorExecutionPrompt";
import { buildCursorPrototypePromptPackage } from "@/lib/prototype/buildCursorPrototypePrompt";
import { buildWorkUnitCursorPrompt } from "@/lib/prototype/prototypeWorkUnitPromptBuilder";
import type { PrototypeContextAnalysis } from "@/lib/prototype/prototypeContextAnalyzer";
import type { PrototypeWorkUnit } from "@/lib/prototype/prototypeRunTypes";

const minimalWorkUnit: PrototypeWorkUnit = {
  id: "wu1",
  order: 1,
  title: "WU",
  description: "d",
  targetArea: "",
  implementationScope: "",
  dependencies: [],
  acceptanceCriteria: [],
  riskLevel: "low",
  estimatedComplexity: "low",
  status: "PENDING",
  branchName: "feat/wu",
  cursorPrompt: null,
  cursorPromptGeneratedAt: null,
  cursorPromptVersion: 1,
  cursorPromptSource: null,
  executionStartedAt: null,
  executionCompletedAt: null,
  cursorRunId: null,
  commitSha: null,
  changedFiles: [],
  prNumber: null,
  prUrl: null,
  mergeSha: null,
  reviewSummary: null,
  startedAt: null,
  finishedAt: null,
  cursorAgentStatusUpper: null,
  cursorLastPolledAt: null,
  cursorLastSummary: null,
};

const analysis: PrototypeContextAnalysis = {
  projectType: "general-b2b-app",
  userType: "b2b-team",
  workflowComplexity: "medium",
  recommendedTemplate: "dashboard",
  recommendedTemplateNotes: [],
  recommendedPages: ["Home"],
  priorityActions: ["Sign in"],
  confidence: 0.8,
  missingItems: [],
};

describe("Cursor prompt builders + optional Knowledge Pack Context", () => {
  it("buildCursorExecutionPrompt omits Knowledge Pack block when context empty", () => {
    const task = { id: "t1", title: "Do work", description: "Desc line", acceptanceCriteria: ["c1"] };
    const project = { id: "p1", name: "Proj" };
    const setup = {
      gitRepoUrl: "https://github.com/o/r.git",
      baseBranch: "main",
      branchStrategy: "feature",
      suggestedBranchName: "feat/x",
      autoCommit: true,
      autoPush: false,
      requireTestsBeforePush: false,
      allowedPathGlobs: ["projects/JYOrchestration/**"],
    };
    const p = buildCursorExecutionPrompt(task, project, setup);
    expect(p).toMatch(/execution engine/i);
    expect(p).not.toMatch(/## Knowledge Pack Context/);
  });

  it("buildCursorExecutionPrompt inserts block between Description and Acceptance criteria", () => {
    const task = { id: "t1", title: "T", description: "Body here", acceptanceCriteria: [] };
    const project = { id: "p1", name: "P" };
    const setup = {
      gitRepoUrl: "https://github.com/o/r.git",
      baseBranch: "main",
      branchStrategy: "feature",
      suggestedBranchName: "feat/x",
      autoCommit: false,
      autoPush: false,
      requireTestsBeforePush: false,
      allowedPathGlobs: [],
    };
    const kp = "## Knowledge Pack Context\n\n- note: test";
    const p = buildCursorExecutionPrompt(task, project, setup, { knowledgePackContextText: kp });
    const d = p.indexOf("## Description");
    const k = p.indexOf("## Knowledge Pack Context");
    const a = p.indexOf("## Acceptance criteria");
    expect(k).toBeGreaterThan(d);
    expect(a).toBeGreaterThan(k);
    expect(p).toContain("note: test");
  });

  it("buildCursorPrototypePromptPackage inserts after Summary when context provided", () => {
    const pkg = buildCursorPrototypePromptPackage({
      analysis,
      projectName: "PN",
      projectDescription: "PD text",
      actors: [],
      flowSteps: [],
      knowledgePackContextText: "## Knowledge Pack Context\n\nSnippet",
    });
    const s = pkg.indexOf("Summary:");
    const k = pkg.indexOf("## Knowledge Pack Context");
    const p = pkg.indexOf("Project type (analyzer):");
    expect(k).toBeGreaterThan(s);
    expect(p).toBeGreaterThan(k);
  });

  it("buildWorkUnitCursorPrompt inserts after Goal before Template id", () => {
    const p = buildWorkUnitCursorPrompt({
      projectName: "PN",
      projectDescription: "goal text",
      selectedTemplate: "t1",
      allWorkUnits: [],
      currentWorkUnit: minimalWorkUnit,
      completedWorkUnits: [],
      ideationSummary: "",
      actorFlowSummary: "",
      featureSummary: "",
      knowledgePackContextText: "KP block content",
    });
    const g = p.indexOf("Goal:");
    const k = p.indexOf("## Knowledge Pack Context");
    const t = p.indexOf("Template id");
    expect(k).toBeGreaterThan(g);
    expect(t).toBeGreaterThan(k);
  });
});
