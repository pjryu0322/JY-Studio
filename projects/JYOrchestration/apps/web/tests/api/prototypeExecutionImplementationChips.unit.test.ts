import { describe, expect, it, vi } from "vitest";
import { mapImplementationChipToAction } from "@/lib/prototype/effectiveImplementationState";
import {
  DATA_MODEL_DRAFT_CHIP,
  DB_INTEGRATION_REVIEW_CHIP,
  MOCK_IMPLEMENTATION_CHIP,
} from "@/lib/prototype/implementationDbStrategy";
import { CODE_AGENT_WIP_WORK_REQUEST_CHIP } from "@/lib/prototype/codeAgentWipExecution";
import {
  STAGE_ACTION_ONLY_CHIP_LABELS,
  tryHandlePrototypeExecutionChip,
} from "@/lib/prototype/prototypeExecutionImplementationChips";
import { WORK_PLAN_DRAFT_GENERATE_CHIP } from "@/lib/prototype/implementationWorkPlanDraft";

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
  it("returns false for unknown labels", () => {
    expect(tryHandlePrototypeExecutionChip("unknown", baseHandlers())).toBe(false);
  });

  it("handles prototype run control chips in fallback", () => {
    const refresh = vi.fn();
    expect(
      tryHandlePrototypeExecutionChip("상태 새로고침", {
        ...baseHandlers(),
        refreshStatus: refresh,
      }),
    ).toBe(true);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("blocks work plan confirm when canConfirmImplementationTaskPlan is false", () => {
    const confirm = vi.fn();
    const toast = vi.fn();
    expect(
      tryHandlePrototypeExecutionChip("구현 작업안 확정", {
        ...baseHandlers(),
        confirmImplementationTaskPlan: confirm,
        showToast: toast,
        canConfirmImplementationTaskPlan: () => {
          toast("blocked");
          return false;
        },
      }),
    ).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("handles DB 연동 필요성 검토 chip", () => {
    const review = vi.fn();
    expect(
      tryHandlePrototypeExecutionChip("DB 연동 필요성 검토", {
        ...baseHandlers(),
        reviewDbIntegrationNeed: review,
      }),
    ).toBe(false);
    expect(review).not.toHaveBeenCalled();
  });

  it("handles Mock 기반 구현 진행 chip", () => {
    const mock = vi.fn();
    expect(
      tryHandlePrototypeExecutionChip("Mock 기반 구현 진행", {
        ...baseHandlers(),
        confirmMockImplementationMode: mock,
      }),
    ).toBe(false);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("stage action chip mapping", () => {
  it("maps primary CTA labels to stage action ids", () => {
    expect(mapImplementationChipToAction(WORK_PLAN_DRAFT_GENERATE_CHIP)).toBe(
      "GENERATE_IMPLEMENTATION_WORK_PLAN",
    );
    expect(mapImplementationChipToAction("구현 작업안 확정")).toBe("CONFIRM_IMPLEMENTATION_WORK_PLAN");
    expect(mapImplementationChipToAction(DB_INTEGRATION_REVIEW_CHIP)).toBe("REVIEW_DB_INTEGRATION");
    expect(mapImplementationChipToAction(DATA_MODEL_DRAFT_CHIP)).toBe("GENERATE_DATA_MODEL_DRAFT");
    expect(mapImplementationChipToAction(MOCK_IMPLEMENTATION_CHIP)).toBe("CONFIRM_MOCK_IMPLEMENTATION");
    expect(mapImplementationChipToAction(CODE_AGENT_WIP_WORK_REQUEST_CHIP)).toBe("REQUEST_CODE_AGENT_WIP");
    expect(mapImplementationChipToAction("구현 실행")).toBeNull();
  });

  it("keeps stage-only labels out of fallback handler", () => {
    for (const label of STAGE_ACTION_ONLY_CHIP_LABELS) {
      expect(mapImplementationChipToAction(label)).not.toBeNull();
      expect(tryHandlePrototypeExecutionChip(label, baseHandlers())).toBe(false);
    }
  });
});
