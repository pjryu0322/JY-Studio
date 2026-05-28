import { describe, expect, it, vi } from "vitest";
import { mapImplementationChipToAction } from "@/lib/prototype/effectiveImplementationState";
import { MOCK_IMPLEMENTATION_CHIP } from "@/lib/prototype/implementationDbStrategy";
import { tryHandlePrototypeExecutionChip } from "@/lib/prototype/prototypeExecutionImplementationChips";

const baseHandlers = () => ({
  openEnvSettings: vi.fn(),
  openArtifactHub: vi.fn(),
  focusComposerForScopeEdit: vi.fn(),
  generateImplementationWorkPlanDraft: vi.fn(),
  confirmImplementationTaskPlan: vi.fn(),
  showRoleCheckDetails: vi.fn(),
  requestCodeAgentWipWork: vi.fn(),
  viewWipChanges: vi.fn(),
  requestRefactor: vi.fn(),
  requestAdditionalEdit: vi.fn(),
  approveDeveloperResult: vi.fn(),
  discardWipWork: vi.fn(),
  requestScmOfficialCommit: vi.fn(),
  reviewDbIntegrationNeed: vi.fn(),
  generateDataModelDraft: vi.fn(),
  confirmMockImplementationMode: vi.fn(),
  prepareImplementationExecution: vi.fn(),
  confirmExecution: vi.fn(),
  refreshStatus: vi.fn(),
  showToast: vi.fn(),
  canConfirmImplementationTaskPlan: () => true,
  canRequestCodeAgentWipWork: () => true,
  canApproveDeveloperResult: () => true,
  canRequestScmOfficialCommit: () => true,
  canConfirmExecution: () => true,
});

describe("tryHandlePrototypeExecutionChip", () => {
  it("routes implementation entry chips to handlers", () => {
    const openEnv = vi.fn();
    const openHub = vi.fn();
    const handlers = { ...baseHandlers(), openEnvSettings: openEnv, openArtifactHub: openHub };
    expect(tryHandlePrototypeExecutionChip("환경설정 열기", handlers)).toBe(true);
    expect(openEnv).toHaveBeenCalledOnce();
    expect(tryHandlePrototypeExecutionChip("산출물 다시 보기", handlers)).toBe(true);
    expect(openHub).toHaveBeenCalledOnce();
    expect(tryHandlePrototypeExecutionChip("unknown", handlers)).toBe(false);
  });

  it("blocks work plan confirm when canConfirmImplementationTaskPlan is false", () => {
    const confirm = vi.fn();
    const toast = vi.fn();
    tryHandlePrototypeExecutionChip("구현 작업안 확정", {
      ...baseHandlers(),
      confirmImplementationTaskPlan: confirm,
      showToast: toast,
      canConfirmImplementationTaskPlan: () => {
        toast("blocked");
        return false;
      },
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("blocked");
  });

  it("confirms work plan when canConfirmImplementationTaskPlan is true", () => {
    const confirm = vi.fn();
    tryHandlePrototypeExecutionChip("구현 작업안 확정", {
      ...baseHandlers(),
      confirmImplementationTaskPlan: confirm,
      canConfirmImplementationTaskPlan: () => true,
    });
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("handles DB 연동 필요성 검토 chip", () => {
    const review = vi.fn();
    expect(
      tryHandlePrototypeExecutionChip("DB 연동 필요성 검토", {
        ...baseHandlers(),
        reviewDbIntegrationNeed: review,
      }),
    ).toBe(true);
    expect(review).toHaveBeenCalledOnce();
  });

  it("maps stage-action CTA labels for pipeline routing", () => {
    expect(mapImplementationChipToAction("구현 작업안 확정")).toBe("CONFIRM_IMPLEMENTATION_WORK_PLAN");
    expect(mapImplementationChipToAction(MOCK_IMPLEMENTATION_CHIP)).toBe("CONFIRM_MOCK_IMPLEMENTATION");
    expect(mapImplementationChipToAction("구현 실행")).toBeNull();
  });

  it("handles Mock 기반 구현 진행 chip", () => {
    const mock = vi.fn();
    expect(
      tryHandlePrototypeExecutionChip("Mock 기반 구현 진행", {
        ...baseHandlers(),
        confirmMockImplementationMode: mock,
      }),
    ).toBe(true);
    expect(mock).toHaveBeenCalledOnce();
  });
});
