import { afterEach, describe, expect, it, vi } from "vitest";
import { planAgentHarnessDryRun } from "@/lib/agents/agentHarnessDryRun";
import { AGENT_RUNTIME_DIAGNOSTIC_DISCLAIMER } from "@/lib/agents/agentRuntimeDiagnosticViewTypes";
import { buildAgentRuntimeDiagnosticViewModel } from "@/lib/agents/buildAgentRuntimeDiagnosticViewModel";
import { buildAgentRuntimeDiagnosticSampleViewModel } from "@/lib/agents/buildAgentRuntimeDiagnosticSample";
import { buildConnectorPassThroughRecordCandidate } from "@/lib/agents/buildConnectorPassThroughRecordCandidate";
import { buildTimelineMetadataCandidateFromHarness } from "@/lib/agents/agentRuntimeTimelineReplayCandidate";
import {
  AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
  type AgentRuntimePersistenceCandidate,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import * as connectorFacade from "@/lib/agents/connectorGatewayFacade";
import * as requirementsDispatch from "@/lib/requirements/requirementsIntentDispatch";

describe("multi-agent runtime diagnostic view model stage 2-7", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns mode read_only_dry_run", () => {
    const vm = buildAgentRuntimeDiagnosticViewModel({});
    expect(vm.mode).toBe("read_only_dry_run");
  });

  it("includes disclaimer about no execution or storage", () => {
    const vm = buildAgentRuntimeDiagnosticViewModel({});
    expect(vm.disclaimer).toBe(AGENT_RUNTIME_DIAGNOSTIC_DISCLAIMER);
    expect(vm.disclaimer).toContain("실제 Agent 실행");
    expect(vm.disclaimer).toContain("저장");
  });

  it("fills harness section when harnessResult is provided", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const vm = buildAgentRuntimeDiagnosticViewModel({ harnessResult: harness });
    expect(vm.harness?.agentId).toBe("ai-planner");
    expect(vm.harness?.status).toBe("planned");
    expect(vm.harness?.requiredConnectors).toBeDefined();
  });

  it("fills governance section when governanceDryRun is present", () => {
    const harness = planAgentHarnessDryRun({ intent: "prototype_build" });
    const vm = buildAgentRuntimeDiagnosticViewModel({ harnessResult: harness });
    expect(vm.governance?.status).toBeDefined();
    expect(vm.governance?.requiredChecks.length).toBeGreaterThan(0);
    expect(vm.governance?.evaluatedPolicyIds.length).toBeGreaterThan(0);
  });

  it("fills persistence section with validation and jsonSize", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = buildTimelineMetadataCandidateFromHarness(harness);
    const vm = buildAgentRuntimeDiagnosticViewModel({ persistenceCandidate: candidate });
    expect(vm.persistenceCandidate?.schemaVersion).toBe(candidate.schemaVersion);
    expect(vm.persistenceCandidate?.valid).toBe(true);
    expect(vm.persistenceCandidate?.jsonSize).toBeGreaterThan(0);
  });

  it("fills passThrough section with mode pass_through and recordOnly true", () => {
    const record = buildConnectorPassThroughRecordCandidate({
      boundaryId: "cursor.execution.before",
    });
    const vm = buildAgentRuntimeDiagnosticViewModel({ passThroughRecords: [record] });
    expect(vm.passThrough?.records.length).toBe(1);
    expect(vm.passThrough?.records[0]?.mode).toBe("pass_through");
    expect(vm.passThrough?.records[0]?.recordOnly).toBe(true);
    expect(vm.passThrough?.boundaryCount).toBeGreaterThan(0);
  });

  it("does not call dispatch, connector facade, or requirements dispatch when building VM only", () => {
    const dispatchSpy = vi.spyOn(requirementsDispatch, "dispatchRequirementsUserIntent");
    const connectorSpy = vi.spyOn(connectorFacade, "planConnectorInvocation");
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    buildAgentRuntimeDiagnosticViewModel({ harnessResult: harness });
    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(connectorSpy).not.toHaveBeenCalled();
  });

  it("sample builder returns VM without throwing", () => {
    expect(() => buildAgentRuntimeDiagnosticSampleViewModel()).not.toThrow();
    const vm = buildAgentRuntimeDiagnosticSampleViewModel();
    expect(vm.mode).toBe("read_only_dry_run");
    expect(vm.harness).toBeDefined();
    expect(vm.governance).toBeDefined();
    expect(vm.persistenceCandidate).toBeDefined();
    expect(vm.passThrough?.records.length).toBeGreaterThan(0);
  });

  it("reflects validation warnings in VM warnings", () => {
    const invalid: AgentRuntimePersistenceCandidate = {
      schemaVersion: AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
      registryVersion: "multi-agent-foundation.v1",
      kind: "diagnostic_metadata",
      agentId: 123 as unknown as string,
    };
    const vm = buildAgentRuntimeDiagnosticViewModel({ persistenceCandidate: invalid });
    expect(vm.persistenceCandidate?.valid).toBe(false);
    expect(vm.warnings.length).toBeGreaterThan(0);
  });

  it("includes persistenceDecision when persistenceCandidate is provided", () => {
    const harness = planAgentHarnessDryRun({ intent: "prototype_build" });
    const candidate = buildTimelineMetadataCandidateFromHarness(harness);
    const vm = buildAgentRuntimeDiagnosticViewModel({ persistenceCandidate: candidate });
    expect(vm.persistenceDecision?.decision).toBeDefined();
    expect(vm.persistenceDecision?.requiresSchemaChange).toBe(true);
    expect(vm.persistenceDecision?.requiresMigration).toBe(true);
    expect(typeof vm.persistenceDecision?.findingCount).toBe("number");
  });

  it("sample VM includes persistenceDecision section", () => {
    const vm = buildAgentRuntimeDiagnosticSampleViewModel();
    expect(vm.persistenceDecision?.decision).toBeTruthy();
    expect(vm.persistenceDecision?.recommendedTargets.length).toBeGreaterThan(0);
  });
});
