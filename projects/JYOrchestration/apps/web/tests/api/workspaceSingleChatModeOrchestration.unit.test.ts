import { describe, expect, it } from "vitest";
import { buildPrototypeChatMessages } from "@/lib/prototype/buildPrototypeChatMessages";
import {
  buildImplementationOrchestrationSummary,
  hasImplementationOrchestrationBootstrap,
} from "@/lib/prototype/implementationOrchestrationSummary";
import {
  IMPLEMENTATION_MODE_PRIMARY_MEMBERS,
  PLANNING_MODE_PRIMARY_MEMBERS,
  resolveModeOrchestrationConfig,
} from "@/lib/requirements/modeOrchestrationConfig";
import { resolveWorkspaceSingleChatMode } from "@/lib/requirements/workspaceSingleChatMode";
import { RequirementsWorkspaceStageRenderer } from "@/components/requirements/RequirementsWorkspaceStageRenderer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

describe("workspace SingleChat mode orchestration", () => {
  it("resolves implementation mode from /execution route", () => {
    expect(resolveWorkspaceSingleChatMode({ pathname: "/execution", activeStage: null })).toBe("implementation");
    expect(resolveWorkspaceSingleChatMode({ pathname: "/requirements", activeStage: "ideation" })).toBe("planning");
  });

  it("resolves mode orchestration config for planning and implementation", () => {
    const planning = resolveModeOrchestrationConfig("planning");
    const impl = resolveModeOrchestrationConfig("implementation");
    expect(planning.primaryMembers).toEqual(PLANNING_MODE_PRIMARY_MEMBERS);
    expect(impl.primaryMembers).toEqual(IMPLEMENTATION_MODE_PRIMARY_MEMBERS);
    expect(impl.nextActions).toContain("환경설정 열기");
  });

  it("uses implementation AI members in implementation mode config", () => {
    const impl = resolveModeOrchestrationConfig("implementation");
    expect(impl.primaryMembers).toContain("prototype_build");
    expect(impl.primaryMembers).toContain("prototype_review");
    expect(impl.primaryMembers).toContain("security_reviewer");
    expect(impl.primaryMembers).toContain("memo");
  });

  it("uses SingleChat surface for implementation mode (RequirementsWorkspaceStageRenderer)", () => {
    const surface = createElement("div", { "data-testid": "single-chat" }, "chat");
    const html = renderToStaticMarkup(
      createElement(RequirementsWorkspaceStageRenderer, { singleChatSurface: surface }),
    );
    expect(html).toContain('data-testid="single-chat"');
  });

  it("does not show raw execution setup env card when omitEnvReadinessCard", () => {
    const built = buildPrototypeChatMessages({
      env: { git: "needs", github: "needs", cursor: "error", connectionTest: "needs" },
      canRequestGenerationEnvOk: false,
      canRequestGenerationDesignOk: true,
      envSettingsHref: "/settings",
      templateChipTemplates: [],
      recommendedTemplateId: "default",
      templateConfirmed: false,
      prePlanGate: "idle",
      latestRun: null,
      awaitingExecutionConfirm: false,
      isPlannerRunning: false,
      isRunningState: false,
      isCancelled: false,
      isFailed: false,
      isDeployFailed: false,
      isCompleted: false,
      isDeployPhase: false,
      automationAvailable: false,
      previewUrl: null,
      pagesSettingsHref: null,
      pagesDeployWorkflowRunUrl: null,
      protoBusy: false,
      plannerCreatePending: false,
      plannerProgressStep: 1,
      projectId: "p1",
      omitEnvReadinessCard: true,
    });
    expect(built.some((m) => m.id === "ai-env-check")).toBe(false);
  });

  it("creates implementation orchestration summary messages on implementation entry", () => {
    const messages = buildImplementationOrchestrationSummary({
      projectId: "p1",
      env: { git: "ok", github: "needs", cursor: "error", connectionTest: "needs" },
      envOk: false,
      envSettingsHref: "/settings#execution",
      featureDraftTitles: ["업로드", "요약"],
      projectArtifacts: [],
      artifactOrchestrationV1: null,
      designOk: true,
    });
    expect(messages.length).toBe(4);
    expect(hasImplementationOrchestrationBootstrap(messages)).toBe(true);
    expect(messages.some((m) => m.speakerId === "prototype_build" && m.content.includes("업로드"))).toBe(true);
    expect(messages.some((m) => m.speakerId === "memo" && m.speakerName === "SCM")).toBe(true);
    expect(messages.some((m) => m.meta.interviewSuggestions?.includes("환경설정 열기"))).toBe(true);
  });
});
