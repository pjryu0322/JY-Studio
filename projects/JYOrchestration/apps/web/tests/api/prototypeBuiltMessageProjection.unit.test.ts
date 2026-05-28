import { describe, expect, it } from "vitest";
import { buildPrototypeChatMessages } from "@/lib/prototype/buildPrototypeChatMessages";
import { buildImplementationBootstrapBundle } from "@/lib/prototype/implementationOrchestrationSummary";
import { IMPLEMENTATION_ENTRY_READINESS_HEADLINE } from "@/lib/prototype/implementationWorkPlanDraft";
import {
  mergePrototypeExecutionChatTimeline,
  projectPrototypeBuiltMessagesToRequirements,
} from "@/lib/prototype/prototypeBuiltMessageProjection";

function baseBuildParams() {
  return {
    omitEnvReadinessCard: false,
    env: { git: "ok", github: "ok", cursor: "ok", connectionTest: "ok" },
    canRequestGenerationEnvOk: true,
    canRequestGenerationDesignOk: true,
    envSettingsHref: "/settings",
    templateChipTemplates: [],
    recommendedTemplateId: "default",
    templateConfirmed: false,
    templatePlanningReady: true,
    prePlanGate: "idle" as const,
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
  };
}

describe("projectPrototypeBuiltMessagesToRequirements", () => {
  it("does not show inline template picker by default on implementation entry", () => {
    const built = buildPrototypeChatMessages(baseBuildParams());
    expect(built.some((m) => m.inlineTemplatePicker === true)).toBe(false);
  });

  it("shows inline template picker when explicitly requested", () => {
    const built = buildPrototypeChatMessages({
      ...baseBuildParams(),
      templatePickerRequested: true,
    });
    expect(built.some((m) => m.inlineTemplatePicker === true)).toBe(true);
  });

  it("omits env readiness card messages when orchestration bootstrap owns readiness", () => {
    const built = buildPrototypeChatMessages({
      omitEnvReadinessCard: true,
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
    });
    const { messages } = projectPrototypeBuiltMessagesToRequirements(built);
    expect(messages.some((m) => m.content.includes("Git 저장소"))).toBe(false);
    expect(messages.some((m) => m.content.includes("프로토타입 실행 환경을 점검"))).toBe(false);
  });

  it("drops derived ai-preplan when persisted implementation bootstrap lead message exists", () => {
    const built = buildPrototypeChatMessages({
      omitEnvReadinessCard: false,
      env: { git: "ok", github: "ok", cursor: "ok", connectionTest: "ok" },
      canRequestGenerationEnvOk: true,
      canRequestGenerationDesignOk: true,
      envSettingsHref: "/settings",
      templateChipTemplates: [],
      recommendedTemplateId: "default",
      templateConfirmed: true,
      templatePlanningReady: true,
      prePlanGate: "need_create_click",
      latestRun: null,
      awaitingExecutionConfirm: false,
      isPlannerRunning: false,
      isRunningState: false,
      isCancelled: false,
      isFailed: false,
      isDeployFailed: false,
      isCompleted: false,
      isDeployPhase: false,
      automationAvailable: true,
      previewUrl: null,
      pagesSettingsHref: null,
      pagesDeployWorkflowRunUrl: null,
      protoBusy: false,
      plannerCreatePending: false,
      plannerProgressStep: 1,
      projectId: "p1",
    });
    const { messages: derived } = projectPrototypeBuiltMessagesToRequirements(built);
    expect(derived.some((m) => m.id === "proto-derived-ai-preplan")).toBe(true);

    const bootstrap = buildImplementationBootstrapBundle({
      projectId: "p1",
      env: { git: "ok", github: "ok", cursor: "ok", connectionTest: "ok" },
      envOk: true,
      envSettingsHref: "/settings",
      featureDraftTitles: [],
      projectArtifacts: [
        {
          id: "a1",
          type: "fast_prototype_plan",
          title: "프로토타입 기획안",
          content: "# plan",
          createdAt: "2026-01-01T00:00:00.000Z",
          createdBy: "ai",
          sourceStage: "IDEATION",
        },
      ],
      artifactOrchestrationV1: null,
      designOk: true,
    });

    const merged = mergePrototypeExecutionChatTimeline(derived, bootstrap.messages);
    expect(merged.some((m) => m.id === "proto-derived-ai-preplan")).toBe(false);
    expect(merged.some((m) => m.content.includes(IMPLEMENTATION_ENTRY_READINESS_HEADLINE))).toBe(true);
  });
});
