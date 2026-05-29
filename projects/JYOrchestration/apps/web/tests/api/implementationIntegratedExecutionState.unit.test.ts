import { describe, expect, it } from "vitest";
import {
  buildInitialImplementationIntegratedExecutionState,
  deriveIntegratedExecutionStateReadiness,
  getIntegratedStepStatus,
  finalizeIntegratedStageStep,
  markIntegratedStepDone,
  markIntegratedStepFailed,
  markIntegratedStepInProgress,
} from "@/lib/prototype/implementationIntegratedExecutionState";

const NOW = "2026-05-28T12:00:00.000Z";

describe("implementationIntegratedExecutionState", () => {
  it("buildInitialImplementationIntegratedExecutionState creates four steps", () => {
    const state = buildInitialImplementationIntegratedExecutionState({
      projectId: "p1",
      nowIso: NOW,
    });
    expect(state.items).toHaveLength(4);
    expect(state.items.every((i) => i.status === "not_started")).toBe(true);
  });

  it("deriveIntegratedExecutionStateReadiness keeps not_started before task rows complete", () => {
    const state = deriveIntegratedExecutionStateReadiness({
      projectId: "p1",
      state: null,
      taskRowsCompleted: false,
      nowIso: NOW,
    });
    expect(state.items.find((i) => i.step === "refactor_common")?.status).toBe("not_started");
  });

  it("sets refactor_common ready when task rows completed", () => {
    const state = deriveIntegratedExecutionStateReadiness({
      projectId: "p1",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    expect(state.items.find((i) => i.step === "refactor_common")?.status).toBe("ready");
    expect(state.items.find((i) => i.step === "integrated_review")?.status).toBe("not_started");
  });

  it("sets integrated_review ready after refactor_common done", () => {
    let state = buildInitialImplementationIntegratedExecutionState({ projectId: "p1", nowIso: NOW });
    state = {
      ...state,
      items: state.items.map((item) =>
        item.step === "refactor_common" ? { ...item, status: "done" as const } : item,
      ),
    };
    state = deriveIntegratedExecutionStateReadiness({
      projectId: "p1",
      state,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    expect(state.items.find((i) => i.step === "integrated_review")?.status).toBe("ready");
  });

  it("does not overwrite terminal integrated statuses when promoting readiness", () => {
    let state = buildInitialImplementationIntegratedExecutionState({ projectId: "p1", nowIso: NOW });
    state = {
      ...state,
      items: state.items.map((item) =>
        item.step === "refactor_common" ? { ...item, status: "failed" as const } : item,
      ),
    };
    state = deriveIntegratedExecutionStateReadiness({
      projectId: "p1",
      state,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    expect(state.items.find((i) => i.step === "refactor_common")?.status).toBe("failed");
    expect(state.items.find((i) => i.step === "integrated_review")?.status).toBe("not_started");
  });

  it("markIntegratedStepInProgress then done promotes next step to ready", () => {
    let state = deriveIntegratedExecutionStateReadiness({
      projectId: "p1",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    state = markIntegratedStepInProgress({ state, projectId: "p1", step: "refactor_common", nowIso: NOW });
    expect(getIntegratedStepStatus(state, "refactor_common")).toBe("in_progress");
    state = markIntegratedStepDone({
      state,
      projectId: "p1",
      step: "refactor_common",
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    expect(getIntegratedStepStatus(state, "refactor_common")).toBe("done");
    expect(getIntegratedStepStatus(state, "integrated_review")).toBe("ready");
  });

  it("markIntegratedStepFailed does not overwrite terminal done status", () => {
    let state = deriveIntegratedExecutionStateReadiness({
      projectId: "p1",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    state = markIntegratedStepDone({
      state,
      projectId: "p1",
      step: "refactor_common",
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    const afterFail = markIntegratedStepFailed({
      state,
      projectId: "p1",
      step: "refactor_common",
      errorMessage: "err",
      nowIso: NOW,
    });
    expect(getIntegratedStepStatus(afterFail, "refactor_common")).toBe("done");
  });

  it("finalizeIntegratedStageStep persists only final done state (no stale in_progress)", () => {
    let state = deriveIntegratedExecutionStateReadiness({
      projectId: "p1",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    const done = finalizeIntegratedStageStep({
      state,
      projectId: "p1",
      step: "refactor_common",
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    expect(getIntegratedStepStatus(done, "refactor_common")).toBe("done");
    expect(getIntegratedStepStatus(done, "integrated_review")).toBe("ready");
    expect(done.items.find((i) => i.step === "refactor_common")?.status).not.toBe("in_progress");
  });
});
