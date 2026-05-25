import { describe, expect, it } from "vitest";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import {
  buildImplementationSlotsFromContext,
  evaluateImplementationSlotsReadiness,
  implementationSlotLabel,
  parseImplementationSlotsV1,
} from "@/lib/prototype/implementationSlots";
import {
  buildConfirmImplementationTaskPlanResult,
  buildImplementationCursorGateContext,
  evaluateImplementationCursorGate,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import { buildPrototypeExecutionOrchestrationPersistPatch } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

function samplePlan(envOk: boolean, designOk: boolean) {
  return buildImplementationTaskPlan({
    projectId: "p1",
    projectArtifacts: [],
    featureDraftTitles: ["업로드 화면"],
    envOk,
    designOk,
    nowIso: "2026-05-19T03:00:00.000Z",
  });
}

describe("buildImplementationSlotsFromContext", () => {
  it("builds implementation slots from task plan and code agent work items", () => {
    const plan = samplePlan(true, true);
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const slots = buildImplementationSlotsFromContext({
      projectId: "p1",
      projectArtifacts: [],
      implementationTaskPlanV1: plan,
      cursorWorkItemsV1: workItems,
      envOk: true,
      designOk: true,
      envCursorBadge: "ok",
    });
    expect(slots.version).toBe("implementation_slots_v1");
    expect(slots.slots.length).toBe(12);
    expect(slots.slots.find((s) => s.key === "implementation_tasks")?.status).toBe("confirmed");
    expect(slots.slots.find((s) => s.key === "wip_branch_name")?.value).toMatch(/^wip\/cursor\//);
    expect(slots.slots.find((s) => s.key === "wip_policy")?.status).toBe("confirmed");
  });
});

describe("evaluateImplementationSlotsReadiness", () => {
  it("evaluates implementation slot readiness", () => {
    const plan = samplePlan(true, true);
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const slots = buildImplementationSlotsFromContext({
      projectId: "p1",
      projectArtifacts: [],
      implementationTaskPlanV1: plan,
      cursorWorkItemsV1: workItems,
      envOk: true,
      designOk: true,
      envCursorBadge: "ok",
    });
    const r = evaluateImplementationSlotsReadiness(slots);
    expect(r.ready).toBe(true);
    expect(r.confirmed).toBeGreaterThanOrEqual(10);
    expect(r.missing).toHaveLength(0);
    expect(r.blocked).toHaveLength(0);
  });

  it("marks scope blocked when design is not ready", () => {
    const plan = samplePlan(false, false);
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const slots = buildImplementationSlotsFromContext({
      projectId: "p1",
      projectArtifacts: [],
      implementationTaskPlanV1: plan,
      cursorWorkItemsV1: workItems,
      envOk: false,
      designOk: false,
    });
    const r = evaluateImplementationSlotsReadiness(slots);
    expect(r.ready).toBe(false);
    expect(r.blocked).toContain("implementation_scope");
  });
});

describe("implementation cursor gate with slots", () => {
  it("blocks code agent WIP request when required implementation slots are missing", () => {
    const plan = samplePlan(true, true);
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const ctx = buildImplementationCursorGateContext(
      {
        implementationTaskPlanV1: plan,
        cursorWorkItemsV1: workItems,
        implementationSlotsV1: null,
      },
      { envOk: true, designOk: true },
    );
    const gate = evaluateImplementationCursorGate(ctx);
    expect(gate.allowed).toBe(false);
    expect(gate.missing.some((m) => m.includes("구현 슬롯"))).toBe(true);
  });

  it("allows gate when task plan, work items, and slots are ready", () => {
    const plan = samplePlan(true, true);
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const slots = buildImplementationSlotsFromContext({
      projectId: "p1",
      projectArtifacts: [],
      implementationTaskPlanV1: plan,
      cursorWorkItemsV1: workItems,
      envOk: true,
      designOk: true,
      envCursorBadge: "ok",
    });
    const gate = evaluateImplementationCursorGate(
      buildImplementationCursorGateContext(
        {
          implementationTaskPlanV1: plan,
          cursorWorkItemsV1: workItems,
          implementationSlotsV1: slots,
        },
        { envOk: true, designOk: true },
      ),
    );
    expect(gate.allowed).toBe(true);
  });
});

describe("implementation slot owners", () => {
  it("assigns implementation slot owners by role", () => {
    const plan = samplePlan(true, true);
    const slots = buildImplementationSlotsFromContext({
      projectId: "p1",
      projectArtifacts: [],
      implementationTaskPlanV1: plan,
      cursorWorkItemsV1: buildCursorWorkItemsFromImplementationTaskPlan(plan),
      envOk: true,
      designOk: true,
      envCursorBadge: "ok",
    });
    expect(slots.slots.find((s) => s.key === "acceptance_criteria")?.owner).toBe("ai_reviewer");
    expect(slots.slots.find((s) => s.key === "security_checks")?.owner).toBe("ai_security");
    expect(slots.slots.find((s) => s.key === "code_agent_provider")?.owner).toBe("scm");
    expect(slots.slots.find((s) => s.key === "implementation_scope")?.owner).toBe("ai_developer");
    expect(slots.slots.find((s) => s.key === "wip_policy")?.owner).toBe("scm");
  });
});

describe("implementation slots state persistence", () => {
  it("persists implementationSlotsV1 in requirements state json", () => {
    const result = buildConfirmImplementationTaskPlanResult({
      projectId: "p1",
      requirementsStateJson: {},
      projectArtifacts: [],
      featureDraftTitles: ["업로드"],
      envOk: true,
      designOk: true,
    });
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    const merged = buildPrototypeExecutionOrchestrationPersistPatch({}, result.orchestrationPatch);
    const parsed = parseRequirementsStateJson(merged);
    expect(parsed.implementationSlotsV1?.version).toBe("implementation_slots_v1");
    expect(parsed.implementationSlotsV1?.readiness.ready).toBe(true);
    const roundTrip = parseImplementationSlotsV1(parsed.implementationSlotsV1);
    expect(roundTrip?.slots.length).toBe(12);
  });
});

describe("implementation slots timeline", () => {
  it("adds implementation_slots_built trace on task plan confirm", () => {
    const result = buildConfirmImplementationTaskPlanResult({
      projectId: "p1",
      requirementsStateJson: {},
      projectArtifacts: [],
      featureDraftTitles: ["업로드"],
      envOk: true,
      designOk: true,
    });
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    const entry = result.orchestrationPatch.promptTimeline.find(
      (e) => e.action === "implementation_slots_built",
    );
    expect(entry?.responseText).toContain("type=implementation_slots_built");
    expect(entry?.responseText).toContain("owners=");
  });
});

describe("implementation slot labels", () => {
  it("uses Korean labels for missing slot messages", () => {
    expect(implementationSlotLabel("code_agent_provider")).toBe("코드 에이전트");
    expect(implementationSlotLabel("acceptance_criteria")).toBe("검수 기준");
  });
});
