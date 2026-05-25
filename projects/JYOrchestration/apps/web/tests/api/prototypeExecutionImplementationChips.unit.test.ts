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
      confirmWorkPlan: vi.fn(),
      confirmExecution: vi.fn(),
      refreshStatus: vi.fn(),
      showToast: vi.fn(),
      canConfirmWorkPlan: () => true,
      canConfirmExecution: () => true,
    };
    expect(tryHandlePrototypeExecutionChip("환경설정 열기", handlers)).toBe(true);
    expect(openEnv).toHaveBeenCalledOnce();
    expect(tryHandlePrototypeExecutionChip("산출물 다시 보기", handlers)).toBe(true);
    expect(openHub).toHaveBeenCalledOnce();
    expect(tryHandlePrototypeExecutionChip("unknown", handlers)).toBe(false);
  });

  it("blocks work plan confirm when canConfirmWorkPlan is false", () => {
    const confirm = vi.fn();
    const toast = vi.fn();
    tryHandlePrototypeExecutionChip("구현 작업안 확정", {
      openEnvSettings: vi.fn(),
      openArtifactHub: vi.fn(),
      focusComposerForScopeEdit: vi.fn(),
      confirmWorkPlan: confirm,
      confirmExecution: vi.fn(),
      refreshStatus: vi.fn(),
      showToast: toast,
      canConfirmWorkPlan: () => {
        toast("blocked");
        return false;
      },
      canConfirmExecution: () => true,
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("blocked");
  });
});
