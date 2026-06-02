import { describe, expect, it } from "vitest";
import {
  buildImplementationTaskListFromSeed,
  evaluatePlanningImplementationExecutionReadiness,
  parseImplementationTaskListV1,
  isPlanningReadyForImplementationExecution,
  summarizeImplementationTaskRoles,
} from "@/lib/requirements/implementationTaskList";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

const NOW = "2026-05-28T00:00:00.000Z";

function makeSeed(): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_slots_and_artifacts",
    lifecycleStatus: "confirmed",
    readiness: { ready: true, score: 1, missing: [], warnings: [] },
    processImplementationItems: [
      {
        id: "proc-1",
        processName: "회원가입",
        actors: ["user"],
        screens: ["회원가입"],
        actions: ["submit"],
        dataTouched: ["user"],
        exceptions: [],
      },
    ],
    screenImplementationItems: [
      {
        id: "screen-1",
        screenName: "회의록 업로드",
        accessibleActors: ["user"],
        actions: ["upload"],
        visibleData: ["title"],
        editableData: ["file"],
        states: ["idle"],
      },
    ],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [{ name: "검색", appliesTo: ["list"], description: "검색 기능", required: true }],
    dataModelSeed: {
      entities: ["MeetingNote"],
      fieldsByEntity: { MeetingNote: ["id", "title"] },
      relationships: [],
      mockDataNotes: [],
    },
    assumptions: [],
    gaps: [],
  };
}

describe("buildImplementationTaskListFromSeed", () => {
  it("creates screen and process tasks and always includes reviewer/security/scm tasks", () => {
    const list = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: makeSeed(),
      nowIso: NOW,
    });
    expect(list.projectId).toBe("p1");
    expect(list.tasks.length).toBeGreaterThan(0);
    expect(list.tasks.some((t) => t.taskType === "screen" && t.ownerRole === "developer")).toBe(true);
    expect(list.tasks.some((t) => t.taskType === "feature" && t.ownerRole === "developer")).toBe(true);
    expect(list.tasks.some((t) => t.ownerRole === "reviewer")).toBe(true);
    expect(list.tasks.some((t) => t.ownerRole === "security")).toBe(true);
    expect(list.tasks.some((t) => t.ownerRole === "scm")).toBe(true);
    expect(list.tasks.some((t) => t.ownerRole === "designer")).toBe(true);
    expect(list.tasks.map((t) => t.taskId).length).toBe(new Set(list.tasks.map((t) => t.taskId)).size);

    const security = list.tasks.find((t) => t.taskId === "SECURITY-001");
    expect(security?.acceptanceCriteria.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(security?.acceptanceCriteria.join("\n")).toContain("확장자");

    const scm = list.tasks.find((t) => t.taskId === "SCM-001");
    expect(scm?.acceptanceCriteria.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(scm?.acceptanceCriteria.join("\n").toLowerCase()).toContain("pr");

    const devTasks = list.tasks.filter((t) => t.ownerRole === "developer" && t.taskId !== "DEV-MOCK-001");
    expect(devTasks.every((t) => !t.dependencies.includes("DEV-MOCK-001"))).toBe(true);
  });

  it("roleSummary counts roles correctly", () => {
    const list = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: makeSeed(),
      nowIso: NOW,
    });
    const summary = summarizeImplementationTaskRoles(list.tasks);
    expect(summary.developer).toBeGreaterThan(0);
    expect(summary.reviewer).toBeGreaterThan(0);
    expect(summary.security).toBeGreaterThan(0);
    expect(summary.scm).toBeGreaterThan(0);
  });
});

describe("planning readiness helpers", () => {
  it("isPlanningReadyForImplementationExecution is true for ready seed + valid task list", () => {
    const seed = makeSeed();
    const list = buildImplementationTaskListFromSeed({ projectId: "p1", seed, nowIso: NOW });
    expect(isPlanningReadyForImplementationExecution({ implementationSeedV1: seed, implementationTaskListV1: list })).toBe(
      true,
    );
    expect(evaluatePlanningImplementationExecutionReadiness({ implementationSeedV1: seed, implementationTaskListV1: list })).toEqual(
      { ok: true },
    );
  });

  it("evaluatePlanningImplementationExecutionReadiness returns missing codes", () => {
    const seed = makeSeed();
    const res = evaluatePlanningImplementationExecutionReadiness({ implementationSeedV1: seed, implementationTaskListV1: null });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.missing).toContain("implementation_task_list_missing");
  });

  it("detects missing security/scm tasks", () => {
    const seed = makeSeed();
    const list = buildImplementationTaskListFromSeed({ projectId: "p1", seed, nowIso: NOW });
    const withoutSecurity = { ...list, tasks: list.tasks.filter((t) => t.ownerRole !== "security"), roleSummary: summarizeImplementationTaskRoles(list.tasks.filter((t) => t.ownerRole !== "security")) };
    const sec = evaluatePlanningImplementationExecutionReadiness({ implementationSeedV1: seed, implementationTaskListV1: withoutSecurity });
    expect(sec.ok).toBe(false);
    if (!sec.ok) expect(sec.missing).toContain("security_tasks_missing");

    const withoutScm = { ...list, tasks: list.tasks.filter((t) => t.ownerRole !== "scm"), roleSummary: summarizeImplementationTaskRoles(list.tasks.filter((t) => t.ownerRole !== "scm")) };
    const scm = evaluatePlanningImplementationExecutionReadiness({ implementationSeedV1: seed, implementationTaskListV1: withoutScm });
    expect(scm.ok).toBe(false);
    if (!scm.ok) expect(scm.missing).toContain("scm_tasks_missing");
  });

  it("rejects candidate or not-ready seed even with task list", () => {
    const seed = makeSeed();
    const list = buildImplementationTaskListFromSeed({ projectId: "p1", seed, nowIso: NOW });
    const candidateSeed = { ...seed, lifecycleStatus: "candidate" as const };
    const cand = evaluatePlanningImplementationExecutionReadiness({ implementationSeedV1: candidateSeed, implementationTaskListV1: list });
    expect(cand.ok).toBe(false);
    if (!cand.ok) expect(cand.missing).toContain("implementation_seed_candidate");

    const notReadySeed = { ...seed, readiness: { ...seed.readiness, ready: false } };
    const nr = evaluatePlanningImplementationExecutionReadiness({ implementationSeedV1: notReadySeed, implementationTaskListV1: list });
    expect(nr.ok).toBe(false);
    if (!nr.ok) expect(nr.missing).toContain("implementation_seed_not_ready");
  });
});

describe("parseImplementationTaskListV1", () => {
  it("returns undefined/null/null for undefined/null/invalid", () => {
    expect(parseImplementationTaskListV1(undefined)).toBeUndefined();
    expect(parseImplementationTaskListV1(null)).toBeNull();
    expect(parseImplementationTaskListV1({ version: "x" })).toBeNull();
  });

  it("parses valid list and normalizes", () => {
    const list = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: makeSeed(),
      nowIso: NOW,
    });
    const parsed = parseImplementationTaskListV1(list);
    expect(parsed?.version).toBe("implementation_task_list_v1");
    expect(parsed?.projectId).toBe("p1");
    expect(parsed?.tasks.length).toBeGreaterThan(0);
  });
});

