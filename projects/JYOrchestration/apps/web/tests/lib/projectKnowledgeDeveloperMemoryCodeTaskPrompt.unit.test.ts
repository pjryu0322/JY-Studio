import { describe, expect, it } from "vitest";
import { buildUserProjectKnowledgeAgentPromptContext } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptContext";
import {
  buildDeveloperMemoryPromptBlock,
  finalizeCodeTaskDeveloperPromptWithAugmentation,
  implementationPromptContextWithDeveloperMemory,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import type { UserProjectKnowledgeMemoryItem } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";

const referenceBlock = "[reference_context]\nSnapshot actor summary.";

function developerContextWithItems() {
  const item: UserProjectKnowledgeMemoryItem = {
    id: "p1:n1:developer",
    sourceProjectId: "p1",
    sourceNodeId: "n1",
    nodeType: "Feature",
    title: "Title",
    summary: "Summary",
    lifecycle: "AUTO_CAPTURED",
    scope: "same_user",
    agent: "developer",
    relevance: 0.9,
    useAs: "implementation_hint",
    reason: "hint",
    promptSummary: "Reuse component layout pattern",
  };
  return buildUserProjectKnowledgeAgentPromptContext({ agent: "developer", items: [item] });
}

describe("developer memory CodeTask prompt helpers", () => {
  it("appends developer section when itemCount > 0", () => {
    const ctx = developerContextWithItems();
    const out = implementationPromptContextWithDeveloperMemory({
      basePrompt: "## 작업 목표\nBuild login",
      developerMemoryContext: ctx,
    });
    expect(out).toContain("[User Project Knowledge for Developer]");
    expect(out).toContain("Reuse component layout pattern");
  });

  it("skips append when itemCount is 0", () => {
    const empty = buildUserProjectKnowledgeAgentPromptContext({ agent: "developer", items: [] });
    expect(
      implementationPromptContextWithDeveloperMemory({ basePrompt: "base", developerMemoryContext: empty }),
    ).toBe("base");
  });

  it("preserves reference_context before developer memory in finalize", () => {
    const ctx = developerContextWithItems();
    const out = finalizeCodeTaskDeveloperPromptWithAugmentation({
      basePrompt: "# CodeTask\n\n## 작업 목표\nLogin screen",
      augmentation: {
        referencePromptContextBlock: referenceBlock,
        developerMemoryContext: ctx,
      },
    });
    expect(out).toContain("## 작업 목표");
    expect(out).toContain("[reference_context]");
    expect(out).toContain("[User Project Knowledge for Developer]");
    expect(out.indexOf("[reference_context]")).toBeLessThan(
      out.indexOf("[User Project Knowledge for Developer]"),
    );
  });

  it("does not mix planner section into developer block", () => {
    const planner = buildUserProjectKnowledgeAgentPromptContext({
      agent: "planner",
      items: [
        {
          id: "p2:n2:planner",
          sourceProjectId: "p2",
          sourceNodeId: "n2",
          nodeType: "Feature",
          title: "P",
          summary: "P",
          lifecycle: "AUTO_CAPTURED",
          scope: "same_user",
          agent: "planner",
          relevance: 0.8,
          useAs: "context",
          reason: "r",
          promptSummary: "planner only",
        },
      ],
    });
    const block = buildDeveloperMemoryPromptBlock({ developerMemoryContext: planner });
    expect(block).toBe("");
  });

  it("hides internal ids from developer memory block", () => {
    const block = buildDeveloperMemoryPromptBlock({
      developerMemoryContext: developerContextWithItems(),
    });
    expect(block).not.toContain("p1:n1:developer");
    expect(block).not.toContain("sourceProjectId");
  });
});

describe("buildCodeTaskDeveloperPromptDetailed with augmentation", () => {
  const targetRepository: ProjectTargetRepository = {
    repoFullName: "acme/generated-app",
    defaultBranch: "main",
    provider: "github",
  };

  const codeTask: ImplementationCodeTaskV1 = {
    codeTaskId: "CT-DEV-MEM-1",
    parentTaskId: "T1",
    title: "Add settings page",
    description: "",
    changeType: "component",
    acceptanceCriteria: ["Settings route renders"],
    verificationHints: ["Manual smoke test"],
    candidateFiles: ["src/app/settings/page.tsx"],
    candidateFileHints: [],
    branchPlan: {
      version: "code_task_branch_plan_v1",
      branchGroup: "feature/settings",
      baseBranch: "main",
      workBranch: "wip/cursor/ct-dev-mem-1",
    },
    fileBoundary: {
      version: "code_task_file_boundary_v1",
      ownedFiles: ["src/app/settings/**"],
      readOnlyFiles: [],
      forbiddenFiles: [],
    },
  };

  it("keeps task goal and adds developer memory section", () => {
    const ctx = developerContextWithItems();
    const { prompt } = buildCodeTaskDeveloperPromptDetailed({
      codeTask,
      targetRepository,
      baseBranch: "main",
      targetRepoKind: "generated_project",
      developerPromptAugmentation: { developerMemoryContext: ctx },
    });
    expect(prompt).toContain("Add settings page");
    expect(prompt).toContain("[User Project Knowledge for Developer]");
  });

  it("does not lengthen prompt when developer memory is empty", () => {
    const empty = buildUserProjectKnowledgeAgentPromptContext({ agent: "developer", items: [] });
    const withAug = buildCodeTaskDeveloperPromptDetailed({
      codeTask,
      targetRepository,
      baseBranch: "main",
      targetRepoKind: "generated_project",
      developerPromptAugmentation: { developerMemoryContext: empty },
    }).prompt;
    const plain = buildCodeTaskDeveloperPromptDetailed({
      codeTask,
      targetRepository,
      baseBranch: "main",
      targetRepoKind: "generated_project",
    }).prompt;
    expect(withAug).toBe(plain);
  });

  it("canonical prompts match when the same augmentation is applied", () => {
    const ctx = developerContextWithItems();
    const augmentation = { developerMemoryContext: ctx };
    const a = buildCodeTaskDeveloperPromptDetailed({
      codeTask,
      targetRepository,
      baseBranch: "main",
      targetRepoKind: "generated_project",
      developerPromptAugmentation: augmentation,
    }).prompt;
    const b = buildCodeTaskDeveloperPromptDetailed({
      codeTask,
      targetRepository,
      baseBranch: "main",
      targetRepoKind: "generated_project",
      developerPromptAugmentation: augmentation,
    }).prompt;
    expect(a).toBe(b);
  });
});
