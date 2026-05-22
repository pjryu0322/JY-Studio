import { describe, expect, it, beforeEach } from "vitest";
import {
  evaluateRuntimeExecutionApiMvp,
  resolveRuntimeExecutionApiMvpDecision,
} from "@/lib/agents/evaluateRuntimeExecutionApiMvp";
import { approveRuntimeExecutionInMemory } from "@/lib/agents/runtimeExecutionApiMvpApproval";
import {
  RUNTIME_EXECUTION_API_CREATE_COMMAND_PREVIEW_MAX,
  RUNTIME_EXECUTION_API_CREATE_PAYLOAD_PREVIEW_MAX,
  RUNTIME_EXECUTION_API_CREATE_PROJECT_ID_MAX,
} from "@/lib/agents/runtimeExecutionApiMvpConstants";
import { normalizeRuntimeExecutionApiCreateRequest } from "@/lib/agents/runtimeExecutionApiMvpResponse";
import { createRuntimeExecutionApiMvp } from "@/lib/agents/runtimeExecutionApiMvpService";
import { createRuntimeExecutionApiMvpStore, type RuntimeExecutionApiMvpStore } from "@/lib/agents/runtimeExecutionApiMvpStore";
import type { RuntimeExecutionRequest } from "@/lib/agents/runtimeExecutionVerticalSliceTypes";
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

  it("evaluator report routeHandlerCount is at least 5", () => {
    expect(evaluateReadyApiMvp().routeHandlerCount).toBeGreaterThanOrEqual(5);
  });

  it("evaluator report serviceActionCount is at least 6", () => {
    expect(evaluateReadyApiMvp().serviceActionCount).toBeGreaterThanOrEqual(6);
  });

  it("evaluator report storeKind is in_memory_map", () => {
    expect(evaluateReadyApiMvp().storeKind).toBe("in_memory_map");
  });

  it("evaluator report boundaryReportIncludedInEveryResponse is true", () => {
    expect(evaluateReadyApiMvp().boundaryReportIncludedInEveryResponse).toBe(true);
  });

  it("evaluator report stage9AClosureReady is true on ready path", () => {
    expect(evaluateReadyApiMvp().stage9AClosureReady).toBe(true);
  });

  it("ready findings include stage9_a_closure_ready", () => {
    expect(evaluateReadyApiMvp().findings.some((f) => f.code === "stage9_a_closure_ready")).toBe(true);
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

  it("createExecution returns 400 when payloadPreview is whitespace only", () => {
    expect(
      api.createExecution({
        projectId: "p1",
        commandPreview: "cmd",
        payloadPreview: "   ",
        requestedBy: "operator",
      }).status,
    ).toBe(400);
  });

  it("createExecution returns 400 when projectId exceeds max length", () => {
    expect(
      api.createExecution({
        projectId: "x".repeat(RUNTIME_EXECUTION_API_CREATE_PROJECT_ID_MAX + 1),
        commandPreview: "cmd",
        payloadPreview: "pl",
        requestedBy: "operator",
      }).status,
    ).toBe(400);
  });

  it("createExecution returns 400 when commandPreview exceeds max length", () => {
    expect(
      api.createExecution({
        projectId: "p1",
        commandPreview: "x".repeat(RUNTIME_EXECUTION_API_CREATE_COMMAND_PREVIEW_MAX + 1),
        payloadPreview: "pl",
        requestedBy: "operator",
      }).status,
    ).toBe(400);
  });

  it("createExecution returns 400 when payloadPreview exceeds max length", () => {
    expect(
      api.createExecution({
        projectId: "p1",
        commandPreview: "cmd",
        payloadPreview: "x".repeat(RUNTIME_EXECUTION_API_CREATE_PAYLOAD_PREVIEW_MAX + 1),
        requestedBy: "operator",
      }).status,
    ).toBe(400);
  });

  it("normalizeRuntimeExecutionApiCreateRequest trims fields", () => {
    const normalized = normalizeRuntimeExecutionApiCreateRequest({
      projectId: "  p1  ",
      commandPreview: "  cmd  ",
      payloadPreview: "  pl  ",
      requestedBy: "operator",
    });
    expect(normalized.projectId).toBe("p1");
    expect(normalized.commandPreview).toBe("cmd");
    expect(normalized.payloadPreview).toBe("pl");
  });

  it("approveExecution only transitions requested status to validated", () => {
    const created = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const id = created.data!.executionId;
    expect(api.approveExecution(id).data?.statusAfter).toBe("validated");
    expect(api.getExecution(id).data?.status).toBe("validated");
  });

  it("approveExecution returns 409 when request metadata is missing", () => {
    const base = createRuntimeExecutionApiMvpStore();
    const created = base.create({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const id = created.executionId;
    const stubStore: RuntimeExecutionApiMvpStore = {
      ...base,
      get: (executionId: string) => base.get(executionId),
      getRequest: () => undefined,
    };
    expect(
      approveRuntimeExecutionInMemory({
        store: stubStore,
        executionId: id,
        approvedBy: "operator",
        nowIso: "2026-05-19T00:00:00.000Z",
      }).error?.code,
    ).toBe("request_metadata_missing");
  });

  it("runMockExecution returns 409 when approvedForMockRun is false", () => {
    const created = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const id = created.data!.executionId;
    api.approveExecution(id);
    store.setRequest(id, { ...store.getRequest(id)!, approvedForMockRun: false });
    expect(api.runMockExecution(id).error?.code).toBe("mock_run_not_approved");
  });

  it("runMockExecution returns 409 when actualExecutionRequested is true", () => {
    const created = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const id = created.data!.executionId;
    api.approveExecution(id);
    const request = store.getRequest(id)!;
    store.setRequest(id, {
      ...request,
      approvedForMockRun: true,
      actualExecutionRequested: true,
    } as RuntimeExecutionRequest);
    expect(api.runMockExecution(id).error?.code).toBe("actual_execution_requested");
  });

  it("runMockExecution success increases audit event count", () => {
    const created = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const id = created.data!.executionId;
    api.approveExecution(id);
    const mockRun = api.runMockExecution(id);
    expect(mockRun.data!.auditEventCountAfter).toBeGreaterThan(mockRun.data!.auditEventCountBefore);
  });

  it("mock_completed final record keeps actualRunnerInvoked false", () => {
    const created = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const id = created.data!.executionId;
    api.approveExecution(id);
    api.runMockExecution(id);
    expect(api.getExecution(id).data?.actualRunnerInvoked).toBe(false);
  });

  it("mock_completed final record keeps cursorGithubInvoked false", () => {
    const created = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const id = created.data!.executionId;
    api.approveExecution(id);
    api.runMockExecution(id);
    expect(api.getExecution(id).data?.cursorGithubInvoked).toBe(false);
  });

  it("mock_completed final record keeps dbWritten false", () => {
    const created = api.createExecution({
      projectId: "p1",
      commandPreview: "cmd",
      payloadPreview: "pl",
      requestedBy: "operator",
    });
    const id = created.data!.executionId;
    api.approveExecution(id);
    api.runMockExecution(id);
    expect(api.getExecution(id).data?.dbWritten).toBe(false);
  });
});
