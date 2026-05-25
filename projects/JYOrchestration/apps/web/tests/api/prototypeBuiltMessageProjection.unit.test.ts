import { describe, expect, it } from "vitest";
import { buildPrototypeChatMessages } from "@/lib/prototype/buildPrototypeChatMessages";
import { projectPrototypeBuiltMessagesToRequirements } from "@/lib/prototype/prototypeBuiltMessageProjection";

describe("projectPrototypeBuiltMessagesToRequirements", () => {
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
});
