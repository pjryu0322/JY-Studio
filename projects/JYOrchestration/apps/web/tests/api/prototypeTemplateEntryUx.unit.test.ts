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
