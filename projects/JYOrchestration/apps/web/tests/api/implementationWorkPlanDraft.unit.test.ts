import { describe, expect, it } from "vitest";
import {
  buildConfirmImplementationTaskPlanResult,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import { buildGenerateImplementationWorkPlanDraftResult } from "@/lib/prototype/prototypeExecutionWorkPlanDraftActions";
import { buildImplementationBootstrapBundle } from "@/lib/prototype/implementationOrchestrationSummary";
import {
  buildImplementationSeedFromPlanning,
  IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS,
  IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP,
} from "@/lib/requirements/implementationSeed";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";
import {
  buildDerivedImplementationArtifacts,
} from "@/lib/prototype/implementationArtifacts";
import {
  collectReferencePlanningArtifacts,
  IMPLEMENTATION_ENTRY_READINESS_HEADLINE,
  implementationEntryChips,
  implementationEntryChipsForState,
  implementationWorkPlanDraftChips,
  WORK_PLAN_DRAFT_GENERATE_CHIP,
} from "@/lib/prototype/implementationWorkPlanDraft";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

const nowIso = "2026-05-25T10:00:00.000Z";

function seedReadyState() {
  const definitions = buildDynamicServicePlanningSlotDefinitions({
    projectName: "demo",
    projectDescription: "demo",
  });
  const base = initialOrchestrationStateFromDefinitions(definitions, nowIso);
  const slots = { ...base.slots };
  for (const gapKey of IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS) {
    const suffix = IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP[gapKey];
    const key = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
    if (!key || !slots[key]) continue;
    slots[key] = {
      ...slots[key],
      status: "confirmed",
      value: "confirmed slot value for seed gate",
      updatedAt: nowIso,
    };
  }
  const orchestration = { ...base, slots };
  const seed = buildImplementationSeedFromPlanning({
    projectId: "p1",
    orchestration,
    definitions,
    lifecycleStatus: "confirmed",
    nowIso,
  });
  return { orchestration, definitions, seed };
}

const planningArtifacts: ProjectArtifact[] = [
  {
    id: "p1",
    type: "fast_prototype_plan",
    title: "프로토타입 기획안",
    content: "# plan",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "ai",
    sourceStage: "feature-planning",
  },
  {
    id: "f1",
    type: "feature-spec",
    title: "기능 정의서",
    content: "# feature",
    createdAt: "2026-01-02T00:00:00.000Z",
    createdBy: "ai",
    sourceStage: "feature-planning",
  },
];

describe("implementation entry copy", () => {
  it("shows implementation readiness check copy on initial implementation entry", () => {
    const bundle = buildImplementationBootstrapBundle({
      projectId: "p1",
      env: { git: "ok", github: "ok", cursor: "ok", connectionTest: "ok" },
      envOk: true,
      envSettingsHref: "/settings",
      featureDraftTitles: [],
      projectArtifacts: planningArtifacts,
      artifactOrchestrationV1: null,
      designOk: true,
    });
    expect(bundle.messages[0]?.content).toContain(IMPLEMENTATION_ENTRY_READINESS_HEADLINE);
    expect(bundle.messages[0]?.content).not.toContain("현재 산출물 기준으로 구현 작업안을 준비했습니다.");
  });

  it("labels planning artifacts as references, not implementation tasks", () => {
    const bundle = buildImplementationBootstrapBundle({
      projectId: "p1",
      env: { git: "ok", github: "ok", cursor: "ok", connectionTest: "ok" },
      envOk: true,
      envSettingsHref: "/settings",
      featureDraftTitles: ["잘못된 feature 제목"],
      projectArtifacts: planningArtifacts,
      artifactOrchestrationV1: null,
      designOk: true,
    });
    const content = bundle.messages[0]?.content ?? "";
    expect(content).toContain("참조 기획 산출물:");
    expect(content).not.toContain("우선 구현 task:");
    expect(content).toContain("프로토타입 기획안");
    expect(content).not.toContain("잘못된 feature 제목");
  });

  it("does not list missing planning artifacts in implementation entry", () => {
    const refs = collectReferencePlanningArtifacts(planningArtifacts);
    expect(refs.some((r) => r.type === "summary")).toBe(false);
    expect(refs.some((r) => r.type === "fast_prototype_plan")).toBe(true);
  });
});

describe("implementation entry CTA", () => {
  it("uses unique labels on implementation entry chips (no duplicate CTAs)", () => {
    const chips = implementationEntryChips();
    expect(new Set(chips).size).toBe(chips.length);
  });

  it("shows draft generation CTA when seed and env are ready", () => {
    const chips = implementationEntryChipsForState({
      seedReady: true,
      envOk: true,
      designOk: true,
      hasReferenceArtifacts: true,
    });
    expect(chips).toContain(WORK_PLAN_DRAFT_GENERATE_CHIP);
    expect(chips).not.toContain("구현 작업안 확정");
    expect(chips).not.toContain("구현 범위 수정");
  });

  it("hides draft generation CTA when seed is not ready", () => {
    const chips = implementationEntryChipsForState({
      seedReady: false,
      envOk: true,
      designOk: true,
      hasReferenceArtifacts: true,
    });
    expect(chips).not.toContain(WORK_PLAN_DRAFT_GENERATE_CHIP);
    expect(chips).toContain("구현 준비도 점검");
  });

  it("shows confirm and revise CTAs after implementation draft is generated", () => {
    const chips = implementationWorkPlanDraftChips();
    expect(chips).toContain("구현 작업안 확정");
    expect(chips).toContain("구현 범위 수정");
    expect(chips).toContain("DB 연동 필요성 검토");
    expect(chips).toContain("Mock 기반 구현 진행");
  });
});

describe("implementation work plan draft flow", () => {
  it("blocks implementation work plan confirmation before draft exists", () => {
    const result = buildConfirmImplementationTaskPlanResult({
      projectId: "p1",
      requirementsStateJson: {},
      projectArtifacts: planningArtifacts,
      envOk: true,
      designOk: true,
    });
    expect(result.kind).toBe("blocked");
  });

  it("generates draft and allows confirmation afterward", () => {
    const { orchestration, definitions, seed } = seedReadyState();
    const gen = buildGenerateImplementationWorkPlanDraftResult({
      requirementsStateJson: { singleChatOrchestrationV1: orchestration, implementationSeedV1: seed },
      projectId: "p1",
      projectArtifacts: planningArtifacts,
      orchestration,
      slotDefinitions: definitions,
      implementationSeedV1: seed,
      envOk: true,
      designOk: true,
    });
    expect(gen.kind).toBe("created");
    if (gen.kind !== "created") return;

    const derived = buildDerivedImplementationArtifacts({
      projectId: "p1",
      implementationWorkPlanDraftV1: gen.draft,
    });
    expect(derived.map((d) => d.type)).toContain("implementation-work-plan-draft");

    const confirm = buildConfirmImplementationTaskPlanResult({
      projectId: "p1",
      requirementsStateJson: { prototypeExecutionSingleChatV1: { messages: gen.messages } },
      projectArtifacts: planningArtifacts,
      implementationWorkPlanDraftV1: gen.draft,
      envOk: true,
      designOk: true,
    });
    expect(confirm.kind).toBe("created");
  });
});
