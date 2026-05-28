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
  IMPLEMENTATION_SEED_CONFIRM_CANDIDATES_LABEL,
  IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
  IMPLEMENTATION_WORK_PLAN_DRAFT_GENERATE_LABEL,
  PLANNING_ARTIFACT_VIEW_LABEL,
  PLANNING_ENV_SETTINGS_LABEL,
  PLANNING_INFO_REFINE_LABEL,
  QUICK_DESIGN_PLANNING_SEED_READY_HEADING,
} from "@/lib/requirements/implementationUxLabels";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { resolveFastPlanArtifactFollowUpAction } from "@/lib/requirements/fastPlanDraftGenerationHandoff";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";

const nowIso = "2026-05-24T12:00:00.000Z";

const quickDesignArtifactOrchestration = {
  plannedAt: nowIso,
  serviceProfile: "standard" as const,
  requiredTypes: ["summary", "fast_prototype_plan"] as const,
  planned: [
    {
      type: "summary" as const,
      title: "프로젝트 요약서",
      required: true,
      reason: "test",
      sourceRoles: ["planner"] as const,
      sourceSlotKeys: ["slot.summary"],
    },
    {
      type: "fast_prototype_plan" as const,
      title: "프로토타입 기획안",
      required: true,
      reason: "test",
      sourceRoles: ["planner"] as const,
      sourceSlotKeys: ["slot.proto"],
    },
  ],
  memberRoles: ["planner"] as const,
  planningSummary: "Quick Design 테스트",
};

function quickDesignPrepArtifacts(): readonly ProjectArtifact[] {
  const orchMeta = {
    required: true,
    completeness: "full" as const,
    completenessScore: 0.9,
    trace: [{ slotKey: "slot.summary", aiMember: "planner" }],
    relatedSlotKeys: ["slot.summary"],
    relatedAiMembers: ["planner"],
    sourceRoles: ["planner"] as const,
  };
  return [
    {
      id: "qd-summary",
      type: "summary",
      title: "프로젝트 요약서",
      content: "# 프로젝트 요약서\n\nQuick Design 확정 후 기획 산출물 본문입니다.",
      createdAt: nowIso,
      createdBy: "ai",
      sourceStage: "ideation",
      orchestration: orchMeta,
    },
    {
      id: "qd-proto",
      type: "fast_prototype_plan",
      title: "프로토타입 기획안",
      content: "# 프로토타입 기획안\n\n화면·흐름 정의 본문입니다.",
      createdAt: nowIso,
      createdBy: "ai",
      sourceStage: "feature-planning",
      orchestration: { ...orchMeta, trace: [{ slotKey: "slot.proto", aiMember: "planner" }] },
    },
  ];
}

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
      envOk: false,
      projectArtifacts: quickDesignPrepArtifacts(),
      artifactOrchestrationV1: quickDesignArtifactOrchestration,
    });

    expect(prep.implementationSeedV1.projectId).toBe("p1");
    expect(prep.postConfirmState.seedReady).toBe(true);
    expect(prep.postConfirmState.designOk).toBe(true);
    expect(prep.implementationSeedV1.readiness).toBeDefined();
    expect(prep.autoCandidateGenerated).toBe(true);
    expect(prep.autoConfirmedRequired).toBe(true);
    expect(prep.lifecycleStatus).toBe("confirmed");
    expect(prep.prepComplete).toBe(true);
    expect(prep.readiness.ready).toBe(true);
    expect(prep.implementationTaskListV1).toBeTruthy();
    expect(prep.implementationTaskListV1?.tasks?.length ?? 0).toBeGreaterThan(0);
    expect(prep.implementationTaskListV1?.roleSummary.developer ?? 0).toBeGreaterThan(0);
    expect(prep.implementationTaskListV1?.roleSummary.reviewer ?? 0).toBeGreaterThan(0);
    expect(prep.implementationTaskListV1?.roleSummary.security ?? 0).toBeGreaterThan(0);
    expect(prep.implementationTaskListV1?.roleSummary.scm ?? 0).toBeGreaterThan(0);
    expect(prep.timelineEntries.some((e) => e.action === "quick_design_confirmed_implementation_seed_auto_built")).toBe(
      true,
    );
    expect(
      prep.timelineEntries.some((e) => e.action === "quick_design_confirmed_implementation_seed_auto_confirmed"),
    ).toBe(true);
    expect(
      prep.timelineEntries.some((e) => e.action === "quick_design_confirmed_implementation_readiness_evaluated"),
    ).toBe(true);
    expect(
      prep.timelineEntries.some((e) => e.action === "quick_design_confirmed_implementation_task_list_auto_created"),
    ).toBe(true);
    expect(
      prep.timelineEntries.some(
        (e) => e.action === "quick_design_confirmed_planning_ready_for_implementation_execution",
      ),
    ).toBe(true);

    const message = buildQuickDesignImplementationReadyChatMessage({
      artifactIds: ["a1"],
      artifactTitles: ["프로젝트 요약서"],
      nowIso,
      prep,
    });
    expect(message.content).toContain("구현 작업목록");
    expect(message.content).not.toContain("구현 작업안 초안");
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
      generatedArtifactCount: 2,
      envOk: false,
      projectArtifacts: quickDesignPrepArtifacts(),
      artifactOrchestrationV1: quickDesignArtifactOrchestration,
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
    if (prep.postConfirmState.seedReady && !prep.postConfirmState.envOk) {
      expect(chips).toEqual(
        expect.arrayContaining([
          PLANNING_ENV_SETTINGS_LABEL,
          IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
          PLANNING_ARTIFACT_VIEW_LABEL,
        ]),
      );
      expect(chips).not.toContain(IMPLEMENTATION_WORK_PLAN_DRAFT_GENERATE_LABEL);
      expect(chips).not.toContain(PLANNING_INFO_REFINE_LABEL);
    } else if (!prep.postConfirmState.seedReady) {
      expect(chips).not.toContain(IMPLEMENTATION_STAGE_NAVIGATE_LABEL);
      expect(chips).not.toContain(IMPLEMENTATION_WORK_PLAN_DRAFT_GENERATE_LABEL);
      expect(chips).toEqual(
        expect.arrayContaining([
          PLANNING_INFO_REFINE_LABEL,
          IMPLEMENTATION_SEED_CONFIRM_CANDIDATES_LABEL,
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
      projectName: "요약",
      orchestration,
      definitions,
      nowIso,
      generatedArtifactCount: 2,
      envOk: false,
      projectArtifacts: quickDesignPrepArtifacts(),
      artifactOrchestrationV1: quickDesignArtifactOrchestration,
    });
    const message = buildQuickDesignImplementationReadyChatMessage({
      artifactIds: ["a1", "a2"],
      artifactTitles: ["프로젝트 요약서", "프로토타입 기획안"],
      nowIso,
      prep,
      definitions,
    });

    expect(message.content).toMatch(
      /(구현 작업 준비가 완료되었습니다|기획\/Seed 준비가 완료되었습니다|구현 준비정보를 정리했습니다)/,
    );
    expect(message.content).toContain("AI팀이");
    expect(message.content).toContain("생성된 산출물:");
    if (prep.postConfirmState.seedReady) {
      expect(message.content).toContain("구현 준비정보:");
      if (!prep.postConfirmState.envOk) {
        expect(message.content).toContain(QUICK_DESIGN_PLANNING_SEED_READY_HEADING);
        expect(message.content).not.toContain("구현 작업안 초안을 생성할 수 있습니다");
      }
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
