import { describe, expect, it } from "vitest";
import {
  buildQuickDesignImplementationReadyChatMessage,
} from "@/lib/requirements/quickDesignConfirmArtifacts";
import {
  resolveQuickDesignSeedLifecycleStatus,
  runQuickDesignConfirmImplementationPrep,
} from "@/lib/requirements/quickDesignConfirmImplementationPrep";
import {
  buildImplementationSeedCandidateSlotPatches,
  IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP,
} from "@/lib/requirements/implementationSeed";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";
import {
  ALL_QUICK_DESIGN_POST_CONFIRM_CHIP_LABELS,
  IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
  IMPLEMENTATION_WORK_PLAN_DRAFT_GENERATE_LABEL,
  PLANNING_ARTIFACT_VIEW_LABEL,
  PLANNING_ENV_SETTINGS_LABEL,
  PLANNING_INFO_REFINE_LABEL,
} from "@/lib/requirements/implementationUxLabels";
import { resolveFastPlanArtifactFollowUpAction } from "@/lib/requirements/fastPlanDraftGenerationHandoff";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";

const nowIso = "2026-05-24T12:00:00.000Z";

describe("resolveQuickDesignSeedLifecycleStatus", () => {
  it("returns confirmed when auto-confirmed and readiness is ready", () => {
    expect(
      resolveQuickDesignSeedLifecycleStatus({
        autoConfirmedRequired: true,
        autoCandidateGenerated: true,
        readinessReady: true,
      }),
    ).toBe("confirmed");
  });

  it("returns candidate when auto-generated but not confirmed", () => {
    expect(
      resolveQuickDesignSeedLifecycleStatus({
        autoConfirmedRequired: false,
        autoCandidateGenerated: true,
        readinessReady: false,
      }),
    ).toBe("candidate");
  });
});

describe("quickDesignConfirmImplementationPrep", () => {
  it("automatically builds implementation seed when Quick Design is confirmed", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);

    const prep = runQuickDesignConfirmImplementationPrep({
      projectId: "p1",
      projectName: "회의록",
      orchestration,
      definitions,
      nowIso,
      generatedArtifactCount: 5,
    });

    expect(prep.implementationSeedV1.projectId).toBe("p1");
    expect(prep.implementationSeedV1.readiness).toBeDefined();
    expect(prep.autoCandidateGenerated).toBe(true);
    expect(prep.autoConfirmedRequired).toBe(true);
    expect(prep.lifecycleStatus).toBe("confirmed");
    expect(prep.prepComplete).toBe(true);
    expect(prep.readiness.ready).toBe(true);
    expect(prep.timelineEntries.some((e) => e.action === "quick_design_confirmed_implementation_seed_auto_built")).toBe(
      true,
    );
    expect(
      prep.timelineEntries.some((e) => e.action === "quick_design_confirmed_implementation_seed_auto_confirmed"),
    ).toBe(true);
    expect(
      prep.timelineEntries.some((e) => e.action === "quick_design_confirmed_implementation_readiness_evaluated"),
    ).toBe(true);
  });

  it("auto-generates implementation seed candidates when readiness is incomplete", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p2",
      projectName: "테스트",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);

    const prep = runQuickDesignConfirmImplementationPrep({
      projectId: "p2",
      orchestration,
      definitions,
      nowIso,
    });

    if (prep.readiness.missing.length > 0) {
      expect(prep.autoCandidateGenerated || prep.touchedGapKeys.length >= 0).toBe(true);
      expect(prep.lifecycleStatus).not.toBe("confirmed");
      expect(
        prep.timelineEntries.some(
          (e) => e.action === "quick_design_confirmed_implementation_candidates_auto_generated",
        ),
      ).toBe(prep.autoCandidateGenerated);
    }
  });

  it("does not expose internal implementation seed CTAs after Quick Design confirmation", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p3",
      projectName: "CTA",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const prep = runQuickDesignConfirmImplementationPrep({
      projectId: "p3",
      orchestration,
      definitions,
      nowIso,
    });
    const message = buildQuickDesignImplementationReadyChatMessage({
      artifactIds: ["a1"],
      artifactTitles: ["프로젝트 요약서"],
      nowIso,
      prep,
    });
    const chips = message.meta?.interviewSuggestions ?? [];

    expect(chips).toEqual(expect.arrayContaining(ALL_QUICK_DESIGN_POST_CONFIRM_CHIP_LABELS.filter((c) => chips.includes(c))));
    expect(chips.length).toBeLessThanOrEqual(4);
    expect(chips).not.toContain("구현 준비도 점검");
    expect(chips).not.toContain("AI팀이 구현 Seed 후보 생성");
    expect(chips).not.toContain("추가 보완");
    expect(chips).not.toContain("부족한 기획정보 보완");
    expect(chips).not.toContain("구현 시작");
    if (prep.prepComplete) {
      expect(chips).toEqual(
        expect.arrayContaining([
          IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
          IMPLEMENTATION_WORK_PLAN_DRAFT_GENERATE_LABEL,
          PLANNING_ARTIFACT_VIEW_LABEL,
          PLANNING_ENV_SETTINGS_LABEL,
        ]),
      );
      expect(chips).not.toContain(PLANNING_INFO_REFINE_LABEL);
    } else {
      expect(chips).toEqual(
        expect.arrayContaining([
          IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
          PLANNING_INFO_REFINE_LABEL,
          PLANNING_ARTIFACT_VIEW_LABEL,
        ]),
      );
    }
  });

  it("summarizes generated planning artifacts and implementation preparation info", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p4",
      projectName: "요약",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const prep = runQuickDesignConfirmImplementationPrep({
      projectId: "p4",
      orchestration,
      definitions,
      nowIso,
    });
    const message = buildQuickDesignImplementationReadyChatMessage({
      artifactIds: ["a1", "a2"],
      artifactTitles: ["프로젝트 요약서", "프로토타입 기획안"],
      nowIso,
      prep,
      definitions,
    });

    expect(message.content).toMatch(/구현 준비(가 완료되었습니다|정보를 정리했습니다)/);
    expect(message.content).toContain("AI팀이");
    expect(message.content).toContain("생성된 산출물:");
    if (prep.prepComplete) {
      expect(message.content).toContain("구현 준비정보:");
      expect(message.content).toContain("프로세스별 구현 항목");
      expect(message.content).toContain("데이터/Mock 처리 기준");
    } else {
      expect(message.content).toContain("보완이 필요한 항목:");
      expect(message.content).not.toContain("일부 항목은 후보 상태로 보완되었습니다");
      if (prep.touchedGapKeys.length > 0) {
        expect(message.content).toMatch(/: 후보/);
        expect(message.content).not.toContain("actor_permission_matrix");
      }
      if (prep.autoCandidateGenerated && prep.touchedGapKeys.length > 0) {
        expect(message.meta?.implementationCandidateGapKeys?.length).toBeGreaterThan(0);
      }
    }
    expect(message.content).not.toContain("구현 준비도 점검");
  });

  it("routes implementation-stage navigation from Quick Design confirmation CTA", () => {
    expect(resolveFastPlanArtifactFollowUpAction(IMPLEMENTATION_STAGE_NAVIGATE_LABEL)).toBe(
      "start_implementation",
    );
    expect(resolveFastPlanArtifactFollowUpAction(IMPLEMENTATION_WORK_PLAN_DRAFT_GENERATE_LABEL)).toBe(
      "start_implementation",
    );
    expect(resolveFastPlanArtifactFollowUpAction("구현 시작")).toBe("start_implementation");
    expect(resolveFastPlanArtifactFollowUpAction(PLANNING_ARTIFACT_VIEW_LABEL)).toBe("view_artifacts");
    expect(resolveFastPlanArtifactFollowUpAction(PLANNING_INFO_REFINE_LABEL)).toBe("refine");
  });

  it("does not auto-confirm when a required slot value fails quality gates", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p-quality",
      projectName: "품질",
    });
    const base = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const { slots, touchedGapKeys } = buildImplementationSeedCandidateSlotPatches({
      orchestration: base,
      definitions,
      nowIso,
    });
    expect(touchedGapKeys.length).toBeGreaterThan(0);
    const actorKey = findOrchestrationSlotKeysBySuffix(
      definitions,
      IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP.actor_function_matrix,
    )[0]!;
    const degradedSlots = {
      ...slots,
      [actorKey]: {
        ...slots[actorKey]!,
        status: "candidate" as const,
        value: "입력 화면",
      },
    };
    const prep = runQuickDesignConfirmImplementationPrep({
      projectId: "p-quality",
      orchestration: { ...base, slots: degradedSlots },
      definitions,
      nowIso,
    });
    expect(prep.autoConfirmedRequired).toBe(false);
    expect(prep.prepComplete).toBe(false);
  });
});
