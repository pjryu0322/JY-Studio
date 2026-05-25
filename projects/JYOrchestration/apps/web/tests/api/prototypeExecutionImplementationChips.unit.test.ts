import { describe, expect, it, vi } from "vitest";
import { tryHandlePrototypeExecutionChip } from "@/lib/prototype/prototypeExecutionImplementationChips";

describe("tryHandlePrototypeExecutionChip", () => {
  it("routes implementation entry chips to handlers", () => {
    const openEnv = vi.fn();
    const openHub = vi.fn();
    const handlers = {
      openEnvSettings: openEnv,
      openArtifactHub: openHub,
      focusComposerForScopeEdit: vi.fn(),
      confirmImplementationTaskPlan: vi.fn(),
      requestCursorExecution: vi.fn(),
      prepareImplementationExecution: vi.fn(),
      confirmExecution: vi.fn(),
      refreshStatus: vi.fn(),
      showToast: vi.fn(),
      canConfirmImplementationTaskPlan: () => true,
      canRequestCursorExecution: () => true,
      canConfirmExecution: () => true,
    };
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
      openEnvSettings: vi.fn(),
      openArtifactHub: vi.fn(),
      focusComposerForScopeEdit: vi.fn(),
      confirmImplementationTaskPlan: confirm,
      requestCursorExecution: vi.fn(),
      prepareImplementationExecution: vi.fn(),
      confirmExecution: vi.fn(),
      refreshStatus: vi.fn(),
      showToast: toast,
      canConfirmImplementationTaskPlan: () => {
        toast("blocked");
        return false;
      },
      canRequestCursorExecution: () => true,
      canConfirmExecution: () => true,
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("blocked");
  });
});
