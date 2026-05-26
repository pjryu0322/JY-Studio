import { describe, expect, it } from "vitest";
import {
  buildImplementationSeedFromPlanning,
  buildImplementationSeedCandidateSlotPatches,
  evaluateImplementationSeedReadiness,
  IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS,
  IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP,
  PRODUCT_LEVEL_IMPLEMENTATION_SEED_SLOT_SUFFIXES,
} from "@/lib/requirements/implementationSeed";
import { evaluatePlanningMinimumReadiness } from "@/lib/requirements/planningReadinessGate";
import { buildImplementationWorkPlanDraftFromSeed } from "@/lib/prototype/implementationWorkPlanDraft";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";

const nowIso = "2026-05-25T10:00:00.000Z";

function definitionsForProject() {
  return buildDynamicServicePlanningSlotDefinitions({
    projectName: "회의록",
    projectDescription: "회의 녹음 요약",
  });
}

function orchestrationWithConfirmedSeedSlots(definitions: ReturnType<typeof definitionsForProject>) {
  const base = initialOrchestrationStateFromDefinitions(definitions, nowIso);
  const slots = { ...base.slots };
  for (const gapKey of IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS) {
    const suffix = IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP[gapKey];
    const key = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
    if (!key || !slots[key]) continue;
    slots[key] = {
      ...slots[key],
      status: "confirmed",
      value:
        gapKey === "actor_function_matrix"
          ? "사용자: 업로드, 결과 확인\n검수자: 검토, 승인"
          : gapKey === "screen_action_matrix"
            ? "업로드 화면: 파일 선택, 업로드\n결과 화면: 수정, 다운로드"
            : gapKey === "process_screen_map"
              ? "업로드 → 업로드 화면\n검토 → 결과 화면"
              : gapKey === "common_detail_features"
                ? "로딩\n오류\n빈 결과"
                : "사용자\n작업\n결과",
      updatedAt: nowIso,
    };
  }
  return { ...base, slots };
}

describe("product-level implementation seed slots", () => {
  it("includes product-level implementation seed slots in planning definitions", () => {
    const defs = definitionsForProject();
    for (const suffix of PRODUCT_LEVEL_IMPLEMENTATION_SEED_SLOT_SUFFIXES) {
      expect(findOrchestrationSlotKeysBySuffix(defs, suffix).length).toBeGreaterThan(0);
    }
  });
});

describe("implementation seed readiness", () => {
  it("blocks implementation seed readiness when actor/screen/process/data mappings are missing", () => {
    const definitions = definitionsForProject();
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const readiness = evaluateImplementationSeedReadiness({ orchestration, definitions });
    expect(readiness.ready).toBe(false);
    expect(readiness.missing.length).toBeGreaterThan(0);
    expect(readiness.missing).toContain("actor_function_matrix");
  });
});

describe("implementation seed build", () => {
  it("builds implementation seed from confirmed planning slots", () => {
    const definitions = definitionsForProject();
    const orchestration = orchestrationWithConfirmedSeedSlots(definitions);
    const seed = buildImplementationSeedFromPlanning({
      projectId: "p1",
      orchestration,
      definitions,
      lifecycleStatus: "confirmed",
      nowIso,
    });
    expect(seed.processImplementationItems.length).toBeGreaterThan(0);
    expect(seed.screenImplementationItems.length).toBeGreaterThan(0);
    expect(seed.readiness.ready).toBe(true);
  });

  it("keeps AI-generated implementation seed candidates unconfirmed until user approval", () => {
    const definitions = definitionsForProject();
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const { slots, touchedGapKeys } = buildImplementationSeedCandidateSlotPatches({
      orchestration,
      definitions,
      nowIso,
    });
    expect(touchedGapKeys.length).toBeGreaterThan(0);
    for (const key of touchedGapKeys) {
      const suffix = IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP[key];
      const slotKey = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0]!;
      expect(slots[slotKey]?.status).toBe("candidate");
      expect(slots[slotKey]?.status).not.toBe("confirmed");
    }
  });
});

describe("implementation work plan from seed", () => {
  it("builds implementation work plan draft from implementation seed, not artifact titles", () => {
    const definitions = definitionsForProject();
    const orchestration = orchestrationWithConfirmedSeedSlots(definitions);
    const seed = buildImplementationSeedFromPlanning({
      projectId: "p1",
      orchestration,
      definitions,
      nowIso,
    });
    const draft = buildImplementationWorkPlanDraftFromSeed({
      projectId: "p1",
      seed,
      projectArtifacts: [
        {
          id: "a1",
          type: "feature-spec",
          title: "기능 정의서",
          content: "# spec",
          createdAt: nowIso,
          createdBy: "ai",
          sourceStage: "feature-planning",
        },
      ],
      envOk: true,
      designOk: true,
      nowIso,
    });
    expect(draft.source).toBe("implementation_seed");
    expect(draft.implementationScope.some((s) => s.includes("기능 정의서"))).toBe(false);
    expect(draft.implementationScope.some((s) => s.includes("업로드"))).toBe(true);
    expect(draft.processItems?.length).toBeGreaterThan(0);
  });
});

describe("planning minimum gate regression", () => {
  it("keeps existing planning minimum gate behavior unchanged", () => {
    const definitions = definitionsForProject();
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const readiness = evaluatePlanningMinimumReadiness({ orchestration, definitions });
    expect(readiness.ready).toBe(false);
    expect(readiness.missingRequiredSlotKeys.length).toBeGreaterThan(0);
  });
});
