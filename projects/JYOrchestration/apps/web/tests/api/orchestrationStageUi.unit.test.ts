import { describe, expect, it } from "vitest";
import {
  isOrchestrationServicePlanningDbStage,
  mapInviteOrchestrationUiStageToDbStage,
  orchestrationStageDbToUiSelectValue,
  orchestrationStageUiSelectToDbForSave,
  orchestrationStageUserFacingLabel,
  ORCHESTRATION_STAGE_UI_SERVICE_PLANNING,
} from "@/lib/ai-member/aiMemberOrchestration";
import { formatWorkspaceScreenKeysForDisplay } from "@/lib/workspace-ai/workspaceScreenKeys";

describe("orchestration stage UI mapping", () => {
  it("maps planning DB stages to grouped UI select value", () => {
    expect(orchestrationStageDbToUiSelectValue("spec")).toBe(ORCHESTRATION_STAGE_UI_SERVICE_PLANNING);
    expect(orchestrationStageDbToUiSelectValue("service-flow")).toBe(ORCHESTRATION_STAGE_UI_SERVICE_PLANNING);
    expect(orchestrationStageDbToUiSelectValue("task")).toBe(ORCHESTRATION_STAGE_UI_SERVICE_PLANNING);
  });

  it("preserves planning DB stage on save when UI group unchanged", () => {
    expect(
      orchestrationStageUiSelectToDbForSave(ORCHESTRATION_STAGE_UI_SERVICE_PLANNING, "service-flow")
    ).toBe("service-flow");
    expect(orchestrationStageUiSelectToDbForSave(ORCHESTRATION_STAGE_UI_SERVICE_PLANNING, "task")).toBe("task");
    expect(orchestrationStageUiSelectToDbForSave(ORCHESTRATION_STAGE_UI_SERVICE_PLANNING, "spec")).toBe("spec");
  });

  it("defaults to spec when switching into planning group from outside", () => {
    expect(orchestrationStageUiSelectToDbForSave(ORCHESTRATION_STAGE_UI_SERVICE_PLANNING, "execution-review")).toBe(
      "spec"
    );
    expect(orchestrationStageUiSelectToDbForSave(ORCHESTRATION_STAGE_UI_SERVICE_PLANNING, null)).toBe("spec");
  });

  it("invite maps service-planning by role", () => {
    expect(mapInviteOrchestrationUiStageToDbStage(ORCHESTRATION_STAGE_UI_SERVICE_PLANNING, "task-reviewer")).toBe(
      "task"
    );
    expect(mapInviteOrchestrationUiStageToDbStage(ORCHESTRATION_STAGE_UI_SERVICE_PLANNING, "service-designer")).toBe(
      "service-flow"
    );
    expect(mapInviteOrchestrationUiStageToDbStage(ORCHESTRATION_STAGE_UI_SERVICE_PLANNING, "planner")).toBe("spec");
  });

  it("user-facing labels hide raw planning stage names", () => {
    expect(orchestrationStageUserFacingLabel("spec")).toBe("서비스 기획");
    expect(orchestrationStageUserFacingLabel("execution-review")).toBe("실행 검토");
    expect(orchestrationStageUserFacingLabel("scm-manager")).toBe("PR/merge 관리");
  });

  it("isOrchestrationServicePlanningDbStage", () => {
    expect(isOrchestrationServicePlanningDbStage("spec")).toBe(true);
    expect(isOrchestrationServicePlanningDbStage("execution-review")).toBe(false);
  });
});

describe("formatWorkspaceScreenKeysForDisplay", () => {
  it("collapses full planning trio to one label", () => {
    expect(
      formatWorkspaceScreenKeysForDisplay([
        "requirements_ideation",
        "requirements_service_flow",
        "feature_planning",
      ])
    ).toBe("서비스 기획");
  });

  it("shows individual labels for partial planning participation", () => {
    const t = formatWorkspaceScreenKeysForDisplay(["requirements_ideation"]);
    expect(t).toContain("아이디어 구체화");
    expect(t).not.toContain("서비스 기획");
  });
});
