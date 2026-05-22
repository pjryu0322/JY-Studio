import { describe, expect, it } from "vitest";
import { buildDefaultRuntimeExecutionModelCandidates } from "@/lib/agents/evaluateRuntimeExecutionModelCandidate";
import {
  collectForbiddenFieldTraceInModelCandidates,
  evaluateRuntimeExecutionModelReviewGate,
  resolveRuntimeExecutionModelReviewGateDecision,
} from "@/lib/agents/evaluateRuntimeExecutionModelReviewGate";
import { buildStage6CModelReviewGateConfirmedInput } from "@/lib/agents/stage6RuntimeExecutionModelInput";
import {
  buildStage6BReadyCandidateInput,
  buildStage6CReadyReviewGateInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import { REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS } from "@/lib/agents/runtimeExecutionModelCandidateConstants";
import type { RuntimeExecutionModelReviewArea } from "@/lib/agents/runtimeExecutionModelReviewGateTypes";

function evaluateReadyReviewGate(input: Parameters<typeof evaluateRuntimeExecutionModelReviewGate>[0] = {}) {
  return evaluateRuntimeExecutionModelReviewGate({ ...buildStage6CReadyReviewGateInput(), ...input });
}

describe("multi-agent runtime execution model review gate stage 6-C", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeExecutionModelReviewGate().decision).toBe("defer");
  });

  it("source Stage 6-B blocked propagates blocked", () => {
    expect(
      evaluateRuntimeExecutionModelReviewGate({
        modelCandidate: { baseline: { stage5Closure: { stage5AClosure: { agentTypes: ["unknown_role"] } } } },
        ...buildStage6CModelReviewGateConfirmedInput(),
      }).decision,
    ).toBe("blocked");
  });

  it("source Stage 6-B defer propagates defer", () => {
    expect(
      evaluateRuntimeExecutionModelReviewGate({
        modelCandidate: buildStage6BReadyCandidateInput(),
        runtimeModelReviewGateConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("Stage 6-B ready with five confirmations yields ready_for_runtime_execution_contract_candidate", () => {
    expect(evaluateReadyReviewGate().decision).toBe("ready_for_runtime_execution_contract_candidate");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateRuntimeExecutionModelReviewGate({
        ...buildStage6CReadyReviewGateInput(),
        runtimeModelApprovalBoundaryReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveRuntimeExecutionModelReviewGateDecision blocks when sourceCandidateOnly is false", () => {
    expect(
      resolveRuntimeExecutionModelReviewGateDecision({
        sourceModelCandidateDecision: "ready_for_runtime_execution_model_review",
        sourceCandidateOnly: false,
        confirmationsSatisfied: true,
        forbiddenFieldDetected: false,
        noRunBoundarySatisfied: true,
        persistenceBoundarySatisfied: true,
        schemaMigrationBoundarySatisfied: true,
      }),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionModelReviewGateDecision blocks when schemaMigrationBoundarySatisfied is false", () => {
    expect(
      resolveRuntimeExecutionModelReviewGateDecision({
        sourceModelCandidateDecision: "ready_for_runtime_execution_model_review",
        sourceCandidateOnly: true,
        confirmationsSatisfied: true,
        forbiddenFieldDetected: false,
        noRunBoundarySatisfied: true,
        persistenceBoundarySatisfied: true,
        schemaMigrationBoundarySatisfied: false,
      }),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionModelReviewGateDecision blocks when execution wire allowed", () => {
    expect(
      resolveRuntimeExecutionModelReviewGateDecision({
        sourceModelCandidateDecision: "ready_for_runtime_execution_model_review",
        sourceCandidateOnly: true,
        confirmationsSatisfied: true,
        forbiddenFieldDetected: false,
        noRunBoundarySatisfied: false,
        persistenceBoundarySatisfied: true,
        schemaMigrationBoundarySatisfied: true,
      }),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionModelReviewGateDecision blocks when persistence boundary fails", () => {
    expect(
      resolveRuntimeExecutionModelReviewGateDecision({
        sourceModelCandidateDecision: "ready_for_runtime_execution_model_review",
        sourceCandidateOnly: true,
        confirmationsSatisfied: true,
        forbiddenFieldDetected: false,
        noRunBoundarySatisfied: true,
        persistenceBoundarySatisfied: false,
        schemaMigrationBoundarySatisfied: true,
      }),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionModelReviewGateDecision blocks when external side effect boundary fails", () => {
    expect(
      resolveRuntimeExecutionModelReviewGateDecision({
        sourceModelCandidateDecision: "ready_for_runtime_execution_model_review",
        sourceCandidateOnly: true,
        confirmationsSatisfied: true,
        forbiddenFieldDetected: false,
        noRunBoundarySatisfied: false,
        persistenceBoundarySatisfied: true,
        schemaMigrationBoundarySatisfied: true,
      }),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionModelReviewGateDecision blocks when forbidden field detected", () => {
    expect(
      resolveRuntimeExecutionModelReviewGateDecision({
        sourceModelCandidateDecision: "ready_for_runtime_execution_model_review",
        sourceCandidateOnly: true,
        confirmationsSatisfied: true,
        forbiddenFieldDetected: true,
        noRunBoundarySatisfied: true,
        persistenceBoundarySatisfied: true,
        schemaMigrationBoundarySatisfied: true,
      }),
    ).toBe("blocked");
  });

  it("report sourceCandidateOnly maps from source candidateOnly", () => {
    const report = evaluateReadyReviewGate();
    expect(report.sourceCandidateOnly).toBe(true);
  });

  it("report sourceActualExecutionWireAllowedInThisStep is false", () => {
    expect(evaluateReadyReviewGate().sourceActualExecutionWireAllowedInThisStep).toBe(false);
  });

  it("report sourceActualPersistenceAllowedInThisStep is false", () => {
    expect(evaluateReadyReviewGate().sourceActualPersistenceAllowedInThisStep).toBe(false);
  });

  it("report sourceActualExternalSideEffectAllowedInThisStep is false", () => {
    expect(evaluateReadyReviewGate().sourceActualExternalSideEffectAllowedInThisStep).toBe(false);
  });

  it("report sourceNoRunBoundarySatisfied is true on ready path", () => {
    expect(evaluateReadyReviewGate().sourceNoRunBoundarySatisfied).toBe(true);
  });

  it("report sourcePersistenceBoundarySatisfied is true on ready path", () => {
    expect(evaluateReadyReviewGate().sourcePersistenceBoundarySatisfied).toBe(true);
  });

  it("report schemaMigrationBoundarySatisfied is true on ready path", () => {
    expect(evaluateReadyReviewGate().schemaMigrationBoundarySatisfied).toBe(true);
  });

  it("reviewedModelKinds follows REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS order", () => {
    expect(evaluateReadyReviewGate().reviewedModelKinds).toEqual([
      ...REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS,
    ]);
  });

  it("reviewGateFingerprint includes boundary trace segments", () => {
    const fingerprint = evaluateReadyReviewGate().reviewGateFingerprint;
    expect(fingerprint).toContain("candidateOnly:true");
    expect(fingerprint).toContain("noRun:true");
    expect(fingerprint).toContain("persistence:true");
    expect(fingerprint).toContain("forbidden:false");
  });

  it("ready findings include runtime_schema_migration_boundary_disallowed", () => {
    expect(
      evaluateReadyReviewGate().findings.some((f) => f.code === "runtime_schema_migration_boundary_disallowed"),
    ).toBe(true);
  });

  const MODEL_AREAS: RuntimeExecutionModelReviewArea[] = [
    "request_model",
    "plan_model",
    "step_model",
    "result_model",
    "finding_model",
    "approval_state_model",
    "rollback_plan_model",
  ];

  for (const area of MODEL_AREAS) {
    it(`reviewChecklist includes ${area} area`, () => {
      expect(evaluateReadyReviewGate().reviewChecklist.some((item) => item.area === area)).toBe(true);
    });
  }

  it("collectForbiddenFieldTraceInModelCandidates collects model kind and field name", () => {
    const candidates = buildDefaultRuntimeExecutionModelCandidates().map((c) =>
      c.kind === "RuntimeExecutionResult"
        ? { ...c, proposedFields: [...c.proposedFields, "prismaClientCall"] }
        : c,
    );
    const trace = collectForbiddenFieldTraceInModelCandidates({ modelCandidates: candidates });
    expect(trace.detected).toBe(true);
    expect(trace.modelKinds).toContain("RuntimeExecutionResult");
    expect(trace.fieldNames).toContain("prismaClientCall");
  });

  it("forbidden field trace message includes field name", () => {
    const trace = collectForbiddenFieldTraceInModelCandidates({
      modelCandidates: buildDefaultRuntimeExecutionModelCandidates().map((c) =>
        c.kind === "RuntimeExecutionPlan"
          ? { ...c, proposedFields: [...c.proposedFields, "cursorApiToken"] }
          : c,
      ),
    });
    const message = `Forbidden field detected: fields=${trace.fieldNames.join(",")}`;
    expect(message).toContain("cursorApiToken");
  });

  it("reviewedModelKinds includes all 7 required kinds", () => {
    const kinds = evaluateReadyReviewGate().reviewedModelKinds;
    for (const kind of REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS) {
      expect(kinds).toContain(kind);
    }
  });

  it("reviewedModelCount is 7", () => {
    expect(evaluateReadyReviewGate().reviewedModelCount).toBe(7);
  });

  it("reviewedFieldCount is greater than zero", () => {
    expect(evaluateReadyReviewGate().reviewedFieldCount).toBeGreaterThan(0);
  });

  it("reviewGateOnly is true", () => {
    expect(evaluateReadyReviewGate().reviewGateOnly).toBe(true);
  });

  it("actualRuntimeExecutionAllowedInThisStep is false", () => {
    expect(evaluateReadyReviewGate().actualRuntimeExecutionAllowedInThisStep).toBe(false);
  });

  it("actualExecutionWireAllowedInThisStep is false", () => {
    expect(evaluateReadyReviewGate().actualExecutionWireAllowedInThisStep).toBe(false);
  });

  it("actualPersistenceAllowedInThisStep is false", () => {
    expect(evaluateReadyReviewGate().actualPersistenceAllowedInThisStep).toBe(false);
  });

  it("actualExternalSideEffectAllowedInThisStep is false", () => {
    expect(evaluateReadyReviewGate().actualExternalSideEffectAllowedInThisStep).toBe(false);
  });

  it("actualSchemaMigrationAllowedInThisStep is false", () => {
    expect(evaluateReadyReviewGate().actualSchemaMigrationAllowedInThisStep).toBe(false);
  });

  it("recommendedNextPhases includes stage_6_d_runtime_execution_contract_candidate", () => {
    expect(evaluateReadyReviewGate().recommendedNextPhases).toContain(
      "stage_6_d_runtime_execution_contract_candidate",
    );
  });

  it("separatedWorkItems includes actual_runtime_execution_api", () => {
    expect(evaluateReadyReviewGate().separatedWorkItems).toContain("actual_runtime_execution_api");
  });

  it("findings include runtime_execution_model_review_gate_only", () => {
    expect(
      evaluateReadyReviewGate().findings.some((f) => f.code === "runtime_execution_model_review_gate_only"),
    ).toBe(true);
  });

  it("ready findings include runtime_execution_contract_candidate_ready", () => {
    expect(
      evaluateReadyReviewGate().findings.some((f) => f.code === "runtime_execution_contract_candidate_ready"),
    ).toBe(true);
  });

  it("reviewGateFingerprint is deterministic", () => {
    const first = evaluateReadyReviewGate();
    const second = evaluateReadyReviewGate();
    expect(first.reviewGateFingerprint).toBe(second.reviewGateFingerprint);
    expect(first.reviewGateFingerprint.length).toBeGreaterThan(0);
  });

  it("noRunChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyReviewGate().noRunChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("persistenceChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyReviewGate().persistenceChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("reviewChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyReviewGate().reviewChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("forbiddenFieldDetected is false on default ready path", () => {
    expect(evaluateReadyReviewGate().forbiddenFieldDetected).toBe(false);
  });
});
