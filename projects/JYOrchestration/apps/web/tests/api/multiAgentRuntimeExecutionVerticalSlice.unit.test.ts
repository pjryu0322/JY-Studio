import { describe, expect, it } from "vitest";
import {
  evaluateRuntimeExecutionVerticalSlice,
  resolveRuntimeExecutionVerticalSliceDecision,
} from "@/lib/agents/evaluateRuntimeExecutionVerticalSlice";
import {
  buildStage7CReadyContractBundleClosureInput,
  buildStage8AConfirmedVerticalSliceInput,
  buildStage8AReadyVerticalSliceInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

function evaluateReadySlice(
  input: Parameters<typeof evaluateRuntimeExecutionVerticalSlice>[0] = {},
) {
  return evaluateRuntimeExecutionVerticalSlice({ ...buildStage8AReadyVerticalSliceInput(), ...input });
}

describe("multi-agent runtime execution vertical slice stage 8-A", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeExecutionVerticalSlice().decision).toBe("defer");
  });

  it("Stage 7-C source not closed defers", () => {
    expect(
      evaluateRuntimeExecutionVerticalSlice({
        contractBundleClosure: {},
        ...buildStage8AConfirmedVerticalSliceInput(),
        request: buildStage8AReadyVerticalSliceInput().request,
      }).decision,
    ).toBe("defer");
  });

  it("missing requestId is blocked", () => {
    expect(
      evaluateReadySlice({
        request: { ...buildStage8AReadyVerticalSliceInput().request!, requestId: "" },
      }).decision,
    ).toBe("blocked");
  });

  it("missing projectId is blocked", () => {
    expect(
      evaluateReadySlice({
        request: { ...buildStage8AReadyVerticalSliceInput().request!, projectId: "" },
      }).decision,
    ).toBe("blocked");
  });

  it("missing commandPreview is blocked", () => {
    expect(
      evaluateReadySlice({
        request: { ...buildStage8AReadyVerticalSliceInput().request!, commandPreview: "" },
      }).decision,
    ).toBe("blocked");
  });

  it("actualExecutionRequested true is blocked", () => {
    expect(
      evaluateRuntimeExecutionVerticalSlice({
        ...buildStage8AReadyVerticalSliceInput(),
        request: {
          ...buildStage8AReadyVerticalSliceInput().request!,
          actualExecutionRequested: true as false,
        },
      }).decision,
    ).toBe("blocked");
  });

  it("missing confirmation defers", () => {
    expect(
      evaluateRuntimeExecutionVerticalSlice({
        contractBundleClosure: buildStage7CReadyContractBundleClosureInput(),
        request: buildStage8AReadyVerticalSliceInput().request,
        operatorStage8ApprovalConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("ready input is stage8_minimal_vertical_slice_ready", () => {
    expect(evaluateReadySlice().decision).toBe("stage8_minimal_vertical_slice_ready");
  });

  it("ready report mode is in_memory_mock_runtime_execution", () => {
    expect(evaluateReadySlice().mode).toBe("in_memory_mock_runtime_execution");
  });

  it("ready report inMemoryOnly is true", () => {
    expect(evaluateReadySlice().inMemoryOnly).toBe(true);
  });

  it("ready report mockRunnerOnly is true", () => {
    expect(evaluateReadySlice().mockRunnerOnly).toBe(true);
  });

  it("actualRuntimeExecutionAllowedInThisStep is false", () => {
    expect(evaluateReadySlice().actualRuntimeExecutionAllowedInThisStep).toBe(false);
  });

  it("actualApiRouteAllowedInThisStep is false", () => {
    expect(evaluateReadySlice().actualApiRouteAllowedInThisStep).toBe(false);
  });

  it("actualExecutionRunnerAllowedInThisStep is false", () => {
    expect(evaluateReadySlice().actualExecutionRunnerAllowedInThisStep).toBe(false);
  });

  it("actualDryRunRunnerAllowedInThisStep is false", () => {
    expect(evaluateReadySlice().actualDryRunRunnerAllowedInThisStep).toBe(false);
  });

  it("actualCursorGithubCallAllowedInThisStep is false", () => {
    expect(evaluateReadySlice().actualCursorGithubCallAllowedInThisStep).toBe(false);
  });

  it("actualConnectorGatewayCallAllowedInThisStep is false", () => {
    expect(evaluateReadySlice().actualConnectorGatewayCallAllowedInThisStep).toBe(false);
  });

  it("actualDbWriteAllowedInThisStep is false", () => {
    expect(evaluateReadySlice().actualDbWriteAllowedInThisStep).toBe(false);
  });

  it("actualSchemaMigrationAllowedInThisStep is false", () => {
    expect(evaluateReadySlice().actualSchemaMigrationAllowedInThisStep).toBe(false);
  });

  it("actualUiAllowedInThisStep is false", () => {
    expect(evaluateReadySlice().actualUiAllowedInThisStep).toBe(false);
  });

  it("initialRecord status is requested", () => {
    expect(evaluateReadySlice().initialRecord.status).toBe("requested");
  });

  it("finalRecord status is mock_completed", () => {
    expect(evaluateReadySlice().finalRecord.status).toBe("mock_completed");
  });

  it("finalRecord persisted is false", () => {
    expect(evaluateReadySlice().finalRecord.persisted).toBe(false);
  });

  it("finalRecord actualRunnerInvoked is false", () => {
    expect(evaluateReadySlice().finalRecord.actualRunnerInvoked).toBe(false);
  });

  it("finalRecord cursorGithubInvoked is false", () => {
    expect(evaluateReadySlice().finalRecord.cursorGithubInvoked).toBe(false);
  });

  it("finalRecord connectorGatewayInvoked is false", () => {
    expect(evaluateReadySlice().finalRecord.connectorGatewayInvoked).toBe(false);
  });

  it("finalRecord dbWritten is false", () => {
    expect(evaluateReadySlice().finalRecord.dbWritten).toBe(false);
  });

  it("store records are appended immutably", () => {
    const report = evaluateReadySlice();
    expect(report.store.records.length).toBeGreaterThanOrEqual(2);
    expect(report.store.records[0]).not.toBe(report.store.records[report.store.records.length - 1]);
  });

  it("auditEvents count is at least 3", () => {
    expect(evaluateReadySlice().store.auditEvents.length).toBeGreaterThanOrEqual(3);
  });

  it("auditEvents are inMemoryOnly true", () => {
    expect(evaluateReadySlice().store.auditEvents.every((event) => event.inMemoryOnly === true)).toBe(true);
  });

  it("mockRunnerResult success is true on ready path", () => {
    expect(evaluateReadySlice().mockRunnerResult.success).toBe(true);
  });

  it("mockRunnerResult externalSideEffect is false", () => {
    expect(evaluateReadySlice().mockRunnerResult.externalSideEffect).toBe(false);
  });

  it("mockRunnerResult actualRunnerInvoked is false", () => {
    expect(evaluateReadySlice().mockRunnerResult.actualRunnerInvoked).toBe(false);
  });

  it("fingerprint is deterministic", () => {
    const first = evaluateReadySlice();
    const second = evaluateReadySlice();
    expect(first.verticalSliceFingerprint).toBe(second.verticalSliceFingerprint);
  });

  it("ready findings include stage8_vertical_slice_created", () => {
    expect(evaluateReadySlice().findings.some((f) => f.code === "stage8_vertical_slice_created")).toBe(true);
  });

  it("ready findings include stage8_mock_runner_executed", () => {
    expect(evaluateReadySlice().findings.some((f) => f.code === "stage8_mock_runner_executed")).toBe(true);
  });

  it("ready findings include stage8_status_transition_completed", () => {
    expect(evaluateReadySlice().findings.some((f) => f.code === "stage8_status_transition_completed")).toBe(true);
  });

  it("ready findings include stage8_no_external_side_effect_verified", () => {
    expect(evaluateReadySlice().findings.some((f) => f.code === "stage8_no_external_side_effect_verified")).toBe(true);
  });

  it("ready findings include stage8_minimal_vertical_slice_ready", () => {
    expect(evaluateReadySlice().findings.some((f) => f.code === "stage8_minimal_vertical_slice_ready")).toBe(true);
  });

  it("separatedWorkItems includes actual_api_route_handlers", () => {
    expect(evaluateReadySlice().separatedWorkItems).toContain("actual_api_route_handlers");
  });

  it("separatedWorkItems includes actual_db_write", () => {
    expect(evaluateReadySlice().separatedWorkItems).toContain("actual_db_write");
  });

  it("recommendedNextPhases includes stage_8_b_runtime_execution_api_route_design", () => {
    expect(evaluateReadySlice().recommendedNextPhases).toContain("stage_8_b_runtime_execution_api_route_design");
  });

  it("resolveRuntimeExecutionVerticalSliceDecision blocks when mockRunnerSuccess is false", () => {
    expect(
      resolveRuntimeExecutionVerticalSliceDecision({
        sourceStage7Decision: "stage7_runtime_contract_bundle_closed",
        sourceStage8EntryReady: true,
        requestValid: true,
        confirmationsSatisfied: true,
        mockRunnerSuccess: false,
        actualExecutionRequested: false,
        externalSideEffect: false,
      }),
    ).toBe("blocked");
  });
});
