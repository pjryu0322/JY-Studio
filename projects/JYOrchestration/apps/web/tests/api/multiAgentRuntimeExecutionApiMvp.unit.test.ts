import { describe, expect, it, beforeEach } from "vitest";
import {
  evaluateRuntimeExecutionApiMvp,
  resolveRuntimeExecutionApiMvpDecision,
} from "@/lib/agents/evaluateRuntimeExecutionApiMvp";
import { createRuntimeExecutionApiMvp } from "@/lib/agents/runtimeExecutionApiMvpService";
import { createRuntimeExecutionApiMvpStore } from "@/lib/agents/runtimeExecutionApiMvpStore";
import {
  buildStage8BReadyRuntimeControlBundleInput,
  buildStage9AConfirmedRuntimeExecutionApiMvpInput,
  buildStage9AReadyRuntimeExecutionApiMvpInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type { RuntimeExecutionApiMvpDecisionInput } from "@/lib/agents/runtimeExecutionApiMvpTypes";

function readyApiMvpDecisionInput(
  overrides: Partial<RuntimeExecutionApiMvpDecisionInput> = {},
): RuntimeExecutionApiMvpDecisionInput {
  return {
    sourceDecision: "stage8_runtime_control_bundle_ready",
    sourceStage9EntryReady: true,
    sourceStage9EntryMode: "in_memory_runtime_execution_api_mvp",
    sourceStage9ActualExternalExecutionAllowed: false,
    sourceStage9DbPersistenceAllowed: false,
    sourceStage9UiImplementationAllowed: false,
    confirmationsSatisfied: true,
    ...overrides,
  };
}

function evaluateReadyApiMvp(input: Parameters<typeof evaluateRuntimeExecutionApiMvp>[0] = {}) {
  return evaluateRuntimeExecutionApiMvp({ ...buildStage9AReadyRuntimeExecutionApiMvpInput(), ...input });
}

describe("multi-agent runtime execution API MVP stage 9-A evaluator", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeExecutionApiMvp().decision).toBe("defer");
  });

  it("Stage 8-B source defer propagates defer", () => {
    expect(
      evaluateRuntimeExecutionApiMvp({
        runtimeControlBundle: {
          ...buildStage8BReadyRuntimeControlBundleInput(),
          stage9EntryReviewed: false,
        },
        ...buildStage9AConfirmedRuntimeExecutionApiMvpInput(),
      }).decision,
    ).toBe("defer");
  });

  it("Stage 8-B source blocked propagates blocked", () => {
    expect(
      evaluateRuntimeExecutionApiMvp({
        runtimeControlBundle: {
          verticalSlice: {
            ...buildStage8BReadyRuntimeControlBundleInput().verticalSlice!,
            request: {
              ...buildStage8BReadyRuntimeControlBundleInput().verticalSlice!.request!,
              actualExecutionRequested: true as false,
            },
          },
          ...buildStage9AConfirmedRuntimeExecutionApiMvpInput(),
        },
      }).decision,
    ).toBe("blocked");
  });

  it("Stage 8-B ready with six confirmations yields stage9_runtime_execution_api_mvp_ready", () => {
    expect(evaluateReadyApiMvp().decision).toBe("stage9_runtime_execution_api_mvp_ready");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateRuntimeExecutionApiMvp({
        ...buildStage9AReadyRuntimeExecutionApiMvpInput(),
        noExternalExecutionConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveRuntimeExecutionApiMvpDecision blocks when source stage9EntryMode is wrong", () => {
    expect(
      resolveRuntimeExecutionApiMvpDecision(readyApiMvpDecisionInput({ sourceStage9EntryMode: "wrong_mode" })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionApiMvpDecision blocks when source stage9ActualExternalExecutionAllowed is true", () => {
    expect(
      resolveRuntimeExecutionApiMvpDecision(
        readyApiMvpDecisionInput({ sourceStage9ActualExternalExecutionAllowed: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionApiMvpDecision blocks when source stage9DbPersistenceAllowed is true", () => {
    expect(
      resolveRuntimeExecutionApiMvpDecision(readyApiMvpDecisionInput({ sourceStage9DbPersistenceAllowed: true })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionApiMvpDecision blocks when source stage9UiImplementationAllowed is true", () => {
    expect(
      resolveRuntimeExecutionApiMvpDecision(readyApiMvpDecisionInput({ sourceStage9UiImplementationAllowed: true })),
    ).toBe("blocked");
  });

  it("actualApiRouteImplementedInThisStep is true on ready path", () => {
    expect(evaluateReadyApiMvp().actualApiRouteImplementedInThisStep).toBe(true);
  });

  it("inMemoryStoreImplementedInThisStep is true", () => {
    expect(evaluateReadyApiMvp().inMemoryStoreImplementedInThisStep).toBe(true);
  });

  it("mockRunnerAdapterImplementedInThisStep is true", () => {
    expect(evaluateReadyApiMvp().mockRunnerAdapterImplementedInThisStep).toBe(true);
  });

  it("actualExternalExecutionAllowedInThisStep is false", () => {
    expect(evaluateReadyApiMvp().actualExternalExecutionAllowedInThisStep).toBe(false);
  });

  it("actualCursorGithubCallAllowedInThisStep is false", () => {
    expect(evaluateReadyApiMvp().actualCursorGithubCallAllowedInThisStep).toBe(false);
  });

  it("actualConnectorGatewayCallAllowedInThisStep is false", () => {
    expect(evaluateReadyApiMvp().actualConnectorGatewayCallAllowedInThisStep).toBe(false);
  });

  it("actualDbWriteAllowedInThisStep is false", () => {
    expect(evaluateReadyApiMvp().actualDbWriteAllowedInThisStep).toBe(false);
  });

  it("actualSchemaMigrationAllowedInThisStep is false", () => {
    expect(evaluateReadyApiMvp().actualSchemaMigrationAllowedInThisStep).toBe(false);
  });

  it("actualUiImplementationAllowedInThisStep is false", () => {
    expect(evaluateReadyApiMvp().actualUiImplementationAllowedInThisStep).toBe(false);
  });

  it("supportedActions includes create get list approve mock_run audit", () => {
    const actions = evaluateReadyApiMvp().supportedActions;
    expect(actions).toContain("create");
    expect(actions).toContain("get");
    expect(actions).toContain("list");
    expect(actions).toContain("approve");
    expect(actions).toContain("mock_run");
    expect(actions).toContain("audit");
  });

  it("endpointContracts includes six endpoints", () => {
    expect(evaluateReadyApiMvp().endpointContracts).toHaveLength(6);
  });

  it("ready findings include stage9_runtime_execution_api_mvp_ready", () => {
    expect(evaluateReadyApiMvp().findings.some((f) => f.code === "stage9_runtime_execution_api_mvp_ready")).toBe(
      true,
    );
  });

  it("separatedWorkItems includes actual_cursor_github_execution", () => {
    expect(evaluateReadyApiMvp().separatedWorkItems).toContain("actual_cursor_github_execution");
  });

  it("recommendedNextPhases includes stage_9_b_runtime_execution_runner_adapter_hardening", () => {
    expect(evaluateReadyApiMvp().recommendedNextPhases).toContain(
      "stage_9_b_runtime_execution_runner_adapter_hardening",
    );
  });
});

describe("multi-agent runtime execution API MVP stage 9-A service", () => {
  let store: ReturnType<typeof createRuntimeExecutionApiMvpStore>;
  let api: ReturnType<typeof createRuntimeExecutionApiMvp>;

  beforeEach(() => {
    store = createRuntimeExecutionApiMvpStore();
    api = createRuntimeExecutionApiMvp({ store });
  });

  it("createExecution succeeds", () => {
    const response = api.createExecution({
      projectId: "jy-orchestration",
      commandPreview: "mock-cmd",
      payloadPreview: "payload",
      requestedBy: "operator",
    });
    expect(response.ok).toBe(true);
    expect(response.status).toBe(201);
    expect(response.data?.status).toBe("requested");
  });

  it("createExecution returns 400 when required fields missing", () => {
    const response = api.createExecution({
      projectId: "",
      commandPreview: "",
      payloadPreview: "",
      requestedBy: "operator",
    });
    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
  });

  it("listExecutions returns created record", () => {
    api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const list = api.listExecutions();
    expect(list.ok).toBe(true);
    expect(list.data?.length).toBe(1);
  });

  it("getExecution returns 404 when not found", () => {
    const response = api.getExecution("exec-missing");
    expect(response.status).toBe(404);
  });

  it("approveExecution succeeds with status validated", () => {
    const created = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const approved = api.approveExecution(created.data!.executionId);
    expect(approved.ok).toBe(true);
    expect(approved.data?.statusAfter).toBe("validated");
    expect(api.getExecution(created.data!.executionId).data?.status).toBe("validated");
  });

  it("approveExecution returns 404 for missing executionId", () => {
    expect(api.approveExecution("exec-none").status).toBe(404);
  });

  it("approveExecution returns 409 for mock_completed status", () => {
    const created = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const id = created.data!.executionId;
    api.approveExecution(id);
    api.runMockExecution(id);
    expect(api.approveExecution(id).status).toBe(409);
  });

  it("runMockExecution succeeds only from validated status", () => {
    const created = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const id = created.data!.executionId;
    expect(api.runMockExecution(id).status).toBe(409);
    api.approveExecution(id);
    const mockRun = api.runMockExecution(id);
    expect(mockRun.ok).toBe(true);
    expect(mockRun.data?.statusAfter).toBe("mock_completed");
  });

  it("runMockExecution returns 404 for missing executionId", () => {
    expect(api.runMockExecution("exec-none").status).toBe(404);
  });

  it("runMockExecution returns 409 for requested status", () => {
    const created = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    expect(api.runMockExecution(created.data!.executionId).status).toBe(409);
  });

  it("getAuditEvents returns audit events", () => {
    const created = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const id = created.data!.executionId;
    api.approveExecution(id);
    const audit = api.getAuditEvents(id);
    expect(audit.ok).toBe(true);
    expect(audit.data!.length).toBeGreaterThanOrEqual(2);
  });

  it("all responses have boundary actualDbWriteAllowed false", () => {
    const response = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    expect(response.boundary.actualDbWriteAllowed).toBe(false);
  });

  it("all responses have boundary actualCursorGithubCallAllowed false", () => {
    const response = api.listExecutions();
    expect(response.boundary.actualCursorGithubCallAllowed).toBe(false);
  });

  it("all responses have boundary actualExternalExecutionAllowed false", () => {
    const response = api.listExecutions();
    expect(response.boundary.actualExternalExecutionAllowed).toBe(false);
  });

  it("store resetForTest clears list", () => {
    api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    store.resetForTest();
    expect(api.listExecutions().data).toHaveLength(0);
  });
});
