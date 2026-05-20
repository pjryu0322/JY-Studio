import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateAgentRuntimeExecutionTransition } from "@/lib/agents/evaluateAgentRuntimeExecutionTransition";
import * as harnessModule from "@/lib/agents/agentHarnessDryRun";
import * as connectorFacade from "@/lib/agents/connectorGatewayFacade";
import * as governanceModule from "@/lib/agents/governancePrecheckDryRun";

describe("multi-agent runtime execution transition stage 2-10", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("harness_execution returns defer", () => {
    const report = evaluateAgentRuntimeExecutionTransition({ target: "harness_execution" });
    expect(report.decision).toBe("defer");
  });

  it("agent_execution_record returns ready_for_design", () => {
    const report = evaluateAgentRuntimeExecutionTransition({ target: "agent_execution_record" });
    expect(report.decision).toBe("ready_for_design");
  });

  it("connector_execution_bridge returns defer", () => {
    const report = evaluateAgentRuntimeExecutionTransition({ target: "connector_execution_bridge" });
    expect(report.decision).toBe("defer");
  });

  it("governance_enforcement returns blocked", () => {
    const report = evaluateAgentRuntimeExecutionTransition({ target: "governance_enforcement" });
    expect(report.decision).toBe("blocked");
  });

  it("timeline_replay_persist returns defer", () => {
    const report = evaluateAgentRuntimeExecutionTransition({ target: "timeline_replay_persist" });
    expect(report.decision).toBe("defer");
  });

  it("report mode is read_only_execution_transition_decision", () => {
    const report = evaluateAgentRuntimeExecutionTransition({ target: "harness_execution" });
    expect(report.mode).toBe("read_only_execution_transition_decision");
  });

  it("requiresOperatorApproval is true", () => {
    const report = evaluateAgentRuntimeExecutionTransition({ target: "agent_execution_record" });
    expect(report.requiresOperatorApproval).toBe(true);
  });

  it("requiresRollbackPlan is true", () => {
    const report = evaluateAgentRuntimeExecutionTransition({ target: "connector_execution_bridge" });
    expect(report.requiresRollbackPlan).toBe(true);
  });

  it("does not call harness, connector, or governance execution paths", () => {
    const harnessSpy = vi.spyOn(harnessModule, "planAgentHarnessDryRun");
    const connectorSpy = vi.spyOn(connectorFacade, "planConnectorInvocation");
    const governanceSpy = vi.spyOn(governanceModule, "evaluateGovernancePrecheckDryRun");
    evaluateAgentRuntimeExecutionTransition({ target: "harness_execution" });
    expect(harnessSpy).not.toHaveBeenCalled();
    expect(connectorSpy).not.toHaveBeenCalled();
    expect(governanceSpy).not.toHaveBeenCalled();
  });

  it("unknown target is blocked", () => {
    const report = evaluateAgentRuntimeExecutionTransition({ target: "unknown" });
    expect(report.target).toBe("unknown");
    expect(report.decision).toBe("blocked");
  });
});
