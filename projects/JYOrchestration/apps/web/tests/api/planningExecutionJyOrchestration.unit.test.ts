/**
 * Unit tests for `POST /api/jy-orchestration/planning-execution` request parsing and the same
 * facade → `presentPlanningOriginatedExecutionResult` wire the route uses (no live Next server).
 */
import { describe, expect, it } from "vitest";
import {
  parsePlanningExecutionRequest,
  planningOriginatedExecutionInputFromDto,
} from "../../../../src/http/jyOrchestration/planningOriginatedExecutionRequestDto";
import {
  mvpRunPlanningOriginatedExecutionUseCase,
} from "../../../../src/application/usecases/mvpRunPlanningOriginatedExecutionUseCase";
import type { PlanningOriginatedExecutionDeps } from "../../../../src/application/planningOriginatedExecution/planningOriginatedExecutionContracts";
import { presentPlanningOriginatedExecutionResult } from "../../../../src/application/contracts/planningOriginatedExecutionResponseBuilder";
import {
  buildPlanningOriginatedExecutionViewModel,
} from "../../../../src/application/viewmodels/planningOriginatedExecutionViewModelBuilder";
import { buildPlanningExecutionScreenViewModel } from "../../../../src/application/viewmodels/planningOriginatedExecutionScreenUxBuilder";
import { buildRequirementGapViewModel } from "../../../../src/application/planning/requirementInput/gapUx/buildRequirementGapViewModel";
import { buildRefinedRequirements } from "../../../../src/application/planning/requirementInput/refinement/buildRefinedRequirements";
import { evaluateRequirementReadiness } from "../../../../src/application/planning/requirementInput/refinement/evaluateRequirementReadiness";
import type { PrepareRequirementRefinementDecisionResult } from "../../../../src/application/planning/requirementInput/prepareRequirementRefinementDecision";
import type { RequirementRefinementDecision } from "../../../../src/application/planning/requirementInput/refinement/refinementContracts";
import { mvpResetExecutionState } from "../../../../src/mvp/execution/executionService";

const FORBIDDEN = ["bundle", "handoff", "ExecutionPreparationBundle", "screens", "tasks", "context"] as const;

function assertNoForbiddenKeysInJson(json: string, label: string): void {
  for (const k of FORBIDDEN) {
    expect(json, `${label} must not contain ${k}`).not.toContain(`"${k}"`);
  }
}

describe("planning-execution HTTP request DTO", () => {
  it("rejects empty body shape", () => {
    const r = parsePlanningExecutionRequest(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.length).toBeGreaterThan(0);
  });

  it("rejects missing projectId and mode", () => {
    const r = parsePlanningExecutionRequest({ inputText: "hello" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.includes("projectId"))).toBe(true);
      expect(r.issues.some((i) => i.includes("mode"))).toBe(true);
    }
  });

  it("rejects invalid mode", () => {
    const r = parsePlanningExecutionRequest({
      projectId: "p1",
      mode: "INVALID",
      inputText: "x",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects both inputText and refinement", () => {
    const r = parsePlanningExecutionRequest({
      projectId: "p1",
      mode: "PREPARE_ONLY",
      inputText: "a",
      refinement: { normalizedText: "x", drafts: [], gapViewModel: {}, refinementDecision: {}, refinedRequirements: [], readinessResult: {} },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.includes("only one"))).toBe(true);
  });

  it("accepts minimal valid inputText request", () => {
    const r = parsePlanningExecutionRequest({
      projectId: "  pid-1  ",
      mode: "PREPARE_ONLY",
      inputText: "  need a login page  ",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dto.projectId).toBe("pid-1");
      expect(r.dto.mode).toBe("PREPARE_ONLY");
      expect(r.dto.planningInput.kind).toBe("inputText");
      if (r.dto.planningInput.kind === "inputText") {
        expect(r.dto.planningInput.inputText).toBe("need a login page");
      }
      const input = planningOriginatedExecutionInputFromDto(r.dto);
      expect(input.projectId).toBe("pid-1");
      expect("inputText" in input).toBe(true);
    }
  });
});

describe("planning-execution facade wire (in-process, no HTTP)", () => {
  it("BLOCKED vague input → normalized BLOCKED response without bundle keys", async () => {
    const pid = `http-selfcheck-blocked-${Date.now()}`;
    const facade = await mvpRunPlanningOriginatedExecutionUseCase({
      projectId: pid,
      inputText: "좋은 플랫폼 만들고 싶다",
      mode: "PREPARE_ONLY",
    });
    expect(facade.status).toBe("BLOCKED");
    const out = presentPlanningOriginatedExecutionResult(facade);
    expect(out.ok).toBe(false);
    expect(out.status).toBe("BLOCKED");
    assertNoForbiddenKeysInJson(JSON.stringify(out), "BLOCKED");
    const vm = buildPlanningOriginatedExecutionViewModel(out);
    expect(vm.actions.primaryAction).toBe("EDIT_INPUT");
    expect(vm.counts).toBeNull();
    const screen = buildPlanningExecutionScreenViewModel(vm);
    expect(screen.visibleSections[0]).toBe("INPUT_PANEL");
    expect(screen.emphasizedSummary).toBe("BLOCKING");
  });

  it("NEEDS_CONFIRMATION input → normalized NEEDS_CONFIRMATION", async () => {
    const pid = `http-selfcheck-nc-${Date.now()}`;
    const facade = await mvpRunPlanningOriginatedExecutionUseCase({
      projectId: pid,
      inputText: "사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다",
      mode: "PREPARE_ONLY",
    });
    expect(facade.status).toBe("NEEDS_CONFIRMATION");
    const out = presentPlanningOriginatedExecutionResult(facade);
    expect(out.status).toBe("NEEDS_CONFIRMATION");
    assertNoForbiddenKeysInJson(JSON.stringify(out), "NEEDS_CONFIRMATION");
  });

  function refinementFixture(projectId: string): PrepareRequirementRefinementDecisionResult {
    const autoDec: RequirementRefinementDecision = {
      normalizedText: "Stable demo input for planning-execution route tests",
      drafts: [
        {
          id: `draft-route-${projectId}`,
          projectId,
          description: "Browse posts in list and detail",
          source: "USER_INPUT",
          confidence: "HIGH",
        },
      ],
      decisions: [
        {
          gap: { code: "LIST_DETAIL_SCREENS", question: "Confirm list vs detail", severity: "INFO" },
          mode: "AUTO",
          reason: "route test",
          resolvedValue:
            "Assumed UX: one list/browse screen and one detail screen for the same content type, with navigation between them.",
        },
      ],
    };
    const refined = buildRefinedRequirements({ refinementDecision: autoDec });
    return {
      normalizedText: autoDec.normalizedText,
      drafts: [...autoDec.drafts],
      gapViewModel: buildRequirementGapViewModel({
        normalizedText: autoDec.normalizedText,
        drafts: autoDec.drafts,
        gaps: [],
      }),
      refinementDecision: autoDec,
      refinedRequirements: refined,
      readinessResult: evaluateRequirementReadiness(autoDec),
    };
  }

  it("PREPARE_ONLY + refinement → READY_FOR_EXECUTION normalized response", async () => {
    const pid = `http-selfcheck-ready-${Date.now()}`;
    const refinement = refinementFixture(pid);
    const facade = await mvpRunPlanningOriginatedExecutionUseCase({
      projectId: pid,
      refinement,
      mode: "PREPARE_ONLY",
    });
    expect(facade.ok).toBe(true);
    expect(facade.status).toBe("READY_FOR_EXECUTION");
    const out = presentPlanningOriginatedExecutionResult(facade);
    expect(out.status).toBe("READY_FOR_EXECUTION");
    assertNoForbiddenKeysInJson(JSON.stringify(out), "READY");
  });

  it("PREPARE_AND_START + refinement → EXECUTION_STARTED when guarded start succeeds", async () => {
    mvpResetExecutionState();
    const pid = `http-selfcheck-start-${Date.now()}`;
    const refinement = refinementFixture(pid);
    const facade = await mvpRunPlanningOriginatedExecutionUseCase({
      projectId: pid,
      refinement,
      mode: "PREPARE_AND_START",
    });
    expect(facade.ok).toBe(true);
    expect(facade.status).toBe("EXECUTION_STARTED");
    const out = presentPlanningOriginatedExecutionResult(facade);
    expect(out.status).toBe("EXECUTION_STARTED");
    assertNoForbiddenKeysInJson(JSON.stringify(out), "STARTED");
  });

  it("same facade input yields identical normalized JSON (deterministic present)", async () => {
    const pid = `http-selfcheck-det-${Date.now()}`;
    const refinement = refinementFixture(pid);
    const facade = await mvpRunPlanningOriginatedExecutionUseCase({
      projectId: pid,
      refinement,
      mode: "PREPARE_ONLY",
    });
    const a = presentPlanningOriginatedExecutionResult(facade);
    const b = presentPlanningOriginatedExecutionResult(facade);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("PREPARE_AND_START with simulated start failure → EXECUTION_START_FAILED", async () => {
    mvpResetExecutionState();
    const pid = `http-selfcheck-fail-${Date.now()}`;
    const refinement = refinementFixture(pid);
    const deps: PlanningOriginatedExecutionDeps = {
      startFromPreparation: async () => ({ ok: false as const, reason: "ROUTE_TEST_SIMULATED_START_FAILURE" }),
    };
    const facade = await mvpRunPlanningOriginatedExecutionUseCase(
      { projectId: pid, refinement, mode: "PREPARE_AND_START" },
      deps
    );
    expect(facade.ok).toBe(false);
    expect(facade.status).toBe("EXECUTION_START_FAILED");
    const out = presentPlanningOriginatedExecutionResult(facade);
    expect(out.status).toBe("EXECUTION_START_FAILED");
    assertNoForbiddenKeysInJson(JSON.stringify(out), "START_FAILED");
  });
});
