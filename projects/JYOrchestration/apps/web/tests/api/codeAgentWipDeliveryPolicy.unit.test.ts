import { describe, expect, it } from "vitest";
import { buildCursorSourceGenerationPrompt } from "@/lib/prototype/cursorBridgeExecution";
import {
  buildCodeAgentGitDeliveryRequirementSection,
  buildCodeAgentWipPolicySection,
  CODE_AGENT_GIT_DELIVERY_HEADING,
  TASK_CURSOR_DEFERRED_GITHUB_VERIFY_HINT,
} from "@/lib/prototype/codeAgentWipDeliveryPolicy";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";

const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
  gitRepoName: "owner/repo",
  gitRepoUrl: "https://github.com/owner/repo",
  baseBranch: "main",
})!;

describe("codeAgentWipDeliveryPolicy", () => {
  it("requires WIP branch push while forbidding main merge", () => {
    const section = buildCodeAgentWipPolicySection({
      provider: "cursor",
      taskId: "DEV-SCREEN-002",
      workBranch: "wip/cursor/dev-screen-002",
    });
    expect(section).toContain("GitHub remote에 push");
    expect(section).toContain("wip/cursor/dev-screen-002");
    expect(section).not.toContain("공식 push/PR/merge를 수행하지 않는다");
    expect(section).toContain("main 반영용 PR/merge만 수행하지 않는다");
  });

  it("builds git delivery section with branch and taskId", () => {
    const section = buildCodeAgentGitDeliveryRequirementSection({
      workBranch: "wip/cursor/dev-screen-002",
      taskId: "DEV-SCREEN-002",
      commitMessage: "wip(cursor): [DEV-SCREEN-002]",
      targetRepository: "owner/repo",
    });
    expect(section).toContain(CODE_AGENT_GIT_DELIVERY_HEADING);
    expect(section).toContain("wip/cursor/dev-screen-002");
    expect(section).toContain("DEV-SCREEN-002");
  });

  it("includes deferred github verify hint", () => {
    expect(TASK_CURSOR_DEFERRED_GITHUB_VERIFY_HINT).toContain("WIP branch");
  });
});

describe("buildCursorSourceGenerationPrompt git delivery", () => {
  it("includes selectedTaskId, workBranch, and git delivery section", () => {
    const prompt = buildCursorSourceGenerationPrompt({
      selectedTaskId: "DEV-SCREEN-002",
      workBranch: "wip/cursor/dev-screen-002",
      workItems: [
        {
          id: "wi-1",
          taskId: "DEV-SCREEN-002",
          title: "결과 화면",
          prompt: "## WIP 작업 정책\n- nested",
          requiredFilesHint: [],
          expectedOutput: [],
          testCommands: [],
          forbiddenPaths: [],
          blocked: false,
          blockers: [],
          qualityGate: { promptReady: true, score: 10, missing: [] },
        },
      ],
      targetRepository,
      commitMessage: "wip(cursor): [DEV-SCREEN-002]",
      allowedPathGlobs: ["src/**"],
    });
    expect(prompt).toContain("selectedTaskId: DEV-SCREEN-002");
    expect(prompt).toContain("WIP branch: wip/cursor/dev-screen-002");
    expect(prompt).toContain(CODE_AGENT_GIT_DELIVERY_HEADING);
    expect(prompt).not.toContain("selectedTaskId: undefined");
  });
});
