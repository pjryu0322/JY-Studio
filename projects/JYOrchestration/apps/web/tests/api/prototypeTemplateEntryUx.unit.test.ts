import { describe, expect, it } from "vitest";
import { PROTOTYPE_INLINE_TEMPLATE_AI_VALUE } from "@/lib/prototype/prototypeInlineTemplateConstants";
import { buildPrototypeChatMessages } from "@/lib/prototype/buildPrototypeChatMessages";
import { isPrototypeTemplatePlanningReady } from "@/lib/prototype/prototypeRunUiHelpers";

describe("prototype template entry UX", () => {
  it("hides template selection chat card when omitEnvReadinessCard is true", () => {
    const messages = buildPrototypeChatMessages({
      omitEnvReadinessCard: true,
      env: { git: "needs", github: "needs", cursor: "needs", connectionTest: "needs" },
      canRequestGenerationEnvOk: false,
      canRequestGenerationDesignOk: true,
      envSettingsHref: "/settings",
      templateChipTemplates: [],
      recommendedTemplateId: "meeting_analysis",
      templateConfirmed: false,
      templatePlanningReady: false,
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
      automationAvailable: true,
      previewUrl: null,
      pagesSettingsHref: null,
      pagesDeployWorkflowRunUrl: null,
      protoBusy: false,
      plannerCreatePending: false,
      plannerProgressStep: 1,
      projectId: "p1",
    });
    expect(messages.some((m) => m.id === "ai-template-combo-hint")).toBe(false);
  });

  const baseWorkPlanCardParams = {
    omitEnvReadinessCard: true,
    env: { git: "needs", github: "needs", cursor: "needs", connectionTest: "needs" },
    canRequestGenerationDesignOk: true,
    envSettingsHref: "/settings",
    templateChipTemplates: [],
    recommendedTemplateId: "meeting_analysis",
    templatePlanningReady: true,
    prePlanGate: "need_create_click" as const,
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
  };

  it("hides work plan create card when env is not ready even if template is confirmed", () => {
    const messages = buildPrototypeChatMessages({
      ...baseWorkPlanCardParams,
      canRequestGenerationEnvOk: false,
      templateConfirmed: true,
    });
    expect(messages.some((m) => m.id === "ai-preplan")).toBe(false);
  });

  it("hides work plan create card in bootstrap mode even when env is ready", () => {
    const messages = buildPrototypeChatMessages({
      ...baseWorkPlanCardParams,
      canRequestGenerationEnvOk: true,
      templateConfirmed: true,
    });
    expect(messages.some((m) => m.id === "ai-preplan")).toBe(false);
  });

  it("shows work plan create card on non-bootstrap prototype screen when env is ready", () => {
    const messages = buildPrototypeChatMessages({
      ...baseWorkPlanCardParams,
      omitEnvReadinessCard: false,
      canRequestGenerationEnvOk: true,
      templateConfirmed: true,
    });
    const preplan = messages.find((m) => m.id === "ai-preplan");
    expect(preplan).toBeDefined();
    expect(preplan?.body).toContain("확정된 템플릿");
    const create = preplan?.actions?.find((a) => a.intent === "CREATE_PLAN");
    expect(create?.disabled).not.toBe(true);
  });

  it("hides AI-recommended work plan create card when env is not ready", () => {
    const messages = buildPrototypeChatMessages({
      ...baseWorkPlanCardParams,
      canRequestGenerationEnvOk: false,
      templateConfirmed: false,
      templatePlanningReady: true,
    });
    expect(messages.some((m) => m.id === "ai-preplan")).toBe(false);
  });

  it("allows planning with AI recommended template when env is ok without explicit confirm", () => {
    expect(
      isPrototypeTemplatePlanningReady({
        templateConfirmed: false,
        envOk: true,
        draftPickerValue: PROTOTYPE_INLINE_TEMPLATE_AI_VALUE,
      }),
    ).toBe(true);
  });
});
