import { describe, expect, it } from "vitest";
import {
  buildDefaultRuntimeExecutionModelCandidates,
  buildStage6BReadyCandidateInput,
  buildStage6BRuntimeExecutionModelCandidateConfirmedInput,
  evaluateRuntimeExecutionModelCandidate,
  resolveRuntimeExecutionModelCandidateDecision,
  validateRuntimeExecutionModelCandidates,
} from "@/lib/agents/evaluateRuntimeExecutionModelCandidate";
import { buildStage6AReadyBaselineInput } from "@/lib/agents/evaluateRuntimeExecutionModelBaseline";
import type { RuntimeExecutionModelCandidateKind } from "@/lib/agents/runtimeExecutionModelCandidateTypes";

function evaluateReadyCandidate(input: Parameters<typeof evaluateRuntimeExecutionModelCandidate>[0] = {}) {
  return evaluateRuntimeExecutionModelCandidate({ ...buildStage6BReadyCandidateInput(), ...input });
}

describe("multi-agent runtime execution model candidate stage 6-B", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeExecutionModelCandidate().decision).toBe("defer");
  });

  it("baseline defer propagates defer", () => {
    expect(
      evaluateRuntimeExecutionModelCandidate({
        baseline: { stage5Closure: { stage5AClosureReviewConfirmed: false } },
      }).decision,
    ).toBe("defer");
  });

  it("baseline blocked propagates blocked", () => {
    expect(
      evaluateRuntimeExecutionModelCandidate({
        baseline: { stage5Closure: { stage5AClosure: { agentTypes: ["unknown_role"] } } },
      }).decision,
    ).toBe("blocked");
  });

  it("baseline ready with three confirmations yields ready_for_runtime_execution_model_review", () => {
    expect(evaluateReadyCandidate().decision).toBe("ready_for_runtime_execution_model_review");
  });

  it("modelCandidates includes 7 required kinds", () => {
    const kinds = evaluateReadyCandidate().modelCandidates.map((c) => c.kind);
    expect(kinds).toContain("RuntimeExecutionRequest");
    expect(kinds).toContain("RuntimeExecutionPlan");
    expect(kinds).toContain("RuntimeExecutionStep");
    expect(kinds).toContain("RuntimeExecutionResult");
    expect(kinds).toContain("RuntimeExecutionFinding");
    expect(kinds).toContain("RuntimeExecutionApprovalState");
    expect(kinds).toContain("RuntimeExecutionRollbackPlan");
    expect(kinds).toHaveLength(7);
  });

  it("each modelCandidate.persistenceCandidateOnly is true", () => {
    expect(evaluateReadyCandidate().modelCandidates.every((c) => c.persistenceCandidateOnly === true)).toBe(true);
  });

  it("actualExecutionWireAllowedInThisStep is false", () => {
    expect(evaluateReadyCandidate().actualExecutionWireAllowedInThisStep).toBe(false);
  });

  it("actualPersistenceAllowedInThisStep is false", () => {
    expect(evaluateReadyCandidate().actualPersistenceAllowedInThisStep).toBe(false);
  });

  it("actualExternalSideEffectAllowedInThisStep is false", () => {
    expect(evaluateReadyCandidate().actualExternalSideEffectAllowedInThisStep).toBe(false);
  });

  it("RuntimeExecutionRequest has required proposed fields", () => {
    const model = evaluateReadyCandidate().modelCandidates.find((c) => c.kind === "RuntimeExecutionRequest");
    expect(model?.proposedFields).toEqual(
      expect.arrayContaining(["id", "projectId", "requestedBy", "executionGoal", "createdAt"]),
    );
  });

  it("RuntimeExecutionPlan has required proposed fields", () => {
    const model = evaluateReadyCandidate().modelCandidates.find((c) => c.kind === "RuntimeExecutionPlan");
    expect(model?.proposedFields).toEqual(
      expect.arrayContaining(["id", "requestId", "steps", "approvalState", "rollbackPlan"]),
    );
  });

  it("RuntimeExecutionStep has required proposed fields", () => {
    const model = evaluateReadyCandidate().modelCandidates.find((c) => c.kind === "RuntimeExecutionStep");
    expect(model?.proposedFields).toEqual(
      expect.arrayContaining(["id", "planId", "sequence", "unitKind", "status"]),
    );
  });

  it("RuntimeExecutionResult has required proposed fields", () => {
    const model = evaluateReadyCandidate().modelCandidates.find((c) => c.kind === "RuntimeExecutionResult");
    expect(model?.proposedFields).toEqual(
      expect.arrayContaining(["id", "requestId", "status", "summary", "findings"]),
    );
  });

  it("findings include runtime_execution_model_candidate_created", () => {
    expect(
      evaluateReadyCandidate().findings.some((f) => f.code === "runtime_execution_model_candidate_created"),
    ).toBe(true);
  });

  it("findings include runtime_execution_model_candidate_only", () => {
    expect(
      evaluateReadyCandidate().findings.some((f) => f.code === "runtime_execution_model_candidate_only"),
    ).toBe(true);
  });

  it("missing runtimeModelReviewConfirmed yields defer", () => {
    expect(
      evaluateRuntimeExecutionModelCandidate({
        baseline: buildStage6AReadyBaselineInput(),
        ...buildStage6BRuntimeExecutionModelCandidateConfirmedInput(),
        runtimeModelReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("validateRuntimeExecutionModelCandidates fails when kind missing", () => {
    const incomplete = buildDefaultRuntimeExecutionModelCandidates().filter(
      (c) => c.kind !== "RuntimeExecutionRollbackPlan",
    );
    const validation = validateRuntimeExecutionModelCandidates(incomplete);
    expect(validation.hasRequiredModelKinds).toBe(false);
    expect(validation.missingKinds).toContain("RuntimeExecutionRollbackPlan");
    expect(
      resolveRuntimeExecutionModelCandidateDecision({
        sourceBaselineDecision: "ready_for_execution_model_candidate",
        confirmationsSatisfied: true,
        hasRequiredModelKinds: validation.hasRequiredModelKinds,
        candidatePostureValid: validation.candidatePostureValid,
      }),
    ).toBe("blocked");
  });

  it("duplicate RuntimeExecutionPlan is blocked", () => {
    const candidates = buildDefaultRuntimeExecutionModelCandidates();
    const plan = candidates.find((c) => c.kind === "RuntimeExecutionPlan");
    const validation = validateRuntimeExecutionModelCandidates([...candidates, plan!]);
    expect(validation.duplicateKinds).toContain("RuntimeExecutionPlan");
    expect(validation.candidatePostureValid).toBe(false);
  });

  it("unknown candidate kind is blocked", () => {
    const invalid = [
      ...buildDefaultRuntimeExecutionModelCandidates(),
      {
        kind: "UnknownRuntimeExecutionModel" as RuntimeExecutionModelCandidateKind,
        modelName: "UnknownRuntimeExecutionModel",
        purpose: "invalid",
        proposedFields: ["id"],
        forbiddenFields: [],
        persistenceCandidateOnly: true,
      },
    ];
    const validation = validateRuntimeExecutionModelCandidates(invalid);
    expect(validation.unknownKinds).toContain("UnknownRuntimeExecutionModel");
    expect(validation.candidatePostureValid).toBe(false);
  });

  it("empty purpose is blocked", () => {
    const candidates = buildDefaultRuntimeExecutionModelCandidates().map((c) =>
      c.kind === "RuntimeExecutionRequest" ? { ...c, purpose: "   " } : c,
    );
    const validation = validateRuntimeExecutionModelCandidates(candidates);
    expect(validation.emptyPurposeKinds).toContain("RuntimeExecutionRequest");
    expect(validation.candidatePostureValid).toBe(false);
  });

  it("empty modelName is blocked", () => {
    const candidates = buildDefaultRuntimeExecutionModelCandidates().map((c) =>
      c.kind === "RuntimeExecutionPlan" ? { ...c, modelName: "" } : c,
    );
    const validation = validateRuntimeExecutionModelCandidates(candidates);
    expect(validation.emptyModelNameKinds).toContain("RuntimeExecutionPlan");
    expect(validation.candidatePostureValid).toBe(false);
  });

  it("empty proposedFields is blocked", () => {
    const candidates = buildDefaultRuntimeExecutionModelCandidates().map((c) =>
      c.kind === "RuntimeExecutionStep" ? { ...c, proposedFields: [] } : c,
    );
    const validation = validateRuntimeExecutionModelCandidates(candidates);
    expect(validation.emptyProposedFieldKinds).toContain("RuntimeExecutionStep");
    expect(validation.candidatePostureValid).toBe(false);
  });

  it("forbidden field in proposedFields is blocked", () => {
    const candidates = buildDefaultRuntimeExecutionModelCandidates().map((c) =>
      c.kind === "RuntimeExecutionResult"
        ? { ...c, proposedFields: [...c.proposedFields, "prismaClientCall"] }
        : c,
    );
    const validation = validateRuntimeExecutionModelCandidates(candidates);
    expect(validation.forbiddenFieldKinds).toContain("RuntimeExecutionResult");
    expect(validation.candidatePostureValid).toBe(false);
  });

  it("RuntimeExecutionApprovalState uses requestId and approvalStatus fields", () => {
    const model = evaluateReadyCandidate().modelCandidates.find((c) => c.kind === "RuntimeExecutionApprovalState");
    expect(model?.proposedFields).toEqual(
      expect.arrayContaining(["id", "requestId", "approvalStatus", "approvedBy", "approvedAt"]),
    );
  });

  it("RuntimeExecutionRollbackPlan uses requestId and rollbackRequired fields", () => {
    const model = evaluateReadyCandidate().modelCandidates.find((c) => c.kind === "RuntimeExecutionRollbackPlan");
    expect(model?.proposedFields).toEqual(
      expect.arrayContaining(["id", "requestId", "rollbackSteps", "rollbackRequired"]),
    );
  });

  it("candidateOnly is true", () => {
    expect(evaluateReadyCandidate().candidateOnly).toBe(true);
  });
});
