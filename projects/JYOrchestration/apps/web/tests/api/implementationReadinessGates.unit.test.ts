import { describe, expect, it } from "vitest";
import {
  evaluateImplementationEntrySurfaceReadiness,
  evaluateQuickDesignPostConfirmReadiness,
  evaluateQuickDesignPostConfirmState,
  resolveImplementationEntrySeedReady,
} from "@/lib/requirements/implementationReadinessGates";
import { resolveQuickDesignImplementationReadyCopy } from "@/lib/requirements/quickDesignConfirmArtifacts";
import {
  formatImplementationTaskListRoleSummaryLines,
  formatImplementationTaskListSummarySection,
} from "@/lib/requirements/implementationTaskList";
import {
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  implementationTaskListEntryChipLabels,
  quickDesignPostConfirmChipLabelsForState,
} from "@/lib/requirements/implementationUxLabels";
import {
  IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS,
  IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP,
} from "@/lib/requirements/implementationSeed";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";

const nowIso = "2026-05-28T12:00:00.000Z";

describe("implementationReadinessGates", () => {
  it("evaluateQuickDesignPostConfirmReadiness matches seed prep gate", () => {
    const readiness = evaluateQuickDesignPostConfirmReadiness({
      readiness: { ready: true, score: 1, missing: [], warnings: [] },
      prepComplete: false,
      envOk: true,
    });
    expect(readiness.seedReady).toBe(false);
    expect(readiness.envOk).toBe(true);
  });

  it("evaluateQuickDesignPostConfirmState alias matches readiness evaluator", () => {
    const viaAlias = evaluateQuickDesignPostConfirmState({
      readiness: { ready: true, score: 1, missing: [], warnings: [] },
      prepComplete: true,
      envOk: false,
    });
    expect(viaAlias.seedReady).toBe(true);
    expect(viaAlias.envOk).toBe(false);
  });

  it("evaluateImplementationEntrySurfaceReadiness exposes taskListReady", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({ projectName: "테스트" });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const result = evaluateImplementationEntrySurfaceReadiness({
      orchestration,
      slotDefinitions: definitions,
      envOk: false,
      designOk: true,
      projectArtifacts: [],
    });
    expect(result.taskListReady).toBe(false);
    expect(result.hasReferenceArtifacts).toBe(false);
  });

  it("resolveImplementationEntrySeedReady uses orchestration when seed object is absent", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({ projectName: "테스트" });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    expect(
      resolveImplementationEntrySeedReady({
        orchestration,
        slotDefinitions: definitions,
      }),
    ).toBe(false);
  });

  it("detects reference artifacts from planning outputs on post-confirm", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({ projectName: "테스트" });
    const slots = { ...initialOrchestrationStateFromDefinitions(definitions, nowIso).slots };
    for (const gapKey of IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS) {
      const key = findOrchestrationSlotKeysBySuffix(definitions, IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP[gapKey])[0];
      if (!key || !slots[key]) continue;
      slots[key] = { ...slots[key], status: "confirmed", value: "확정", updatedAt: nowIso };
    }
    const state = evaluateQuickDesignPostConfirmReadiness({
      readiness: { ready: true, score: 1, missing: [], warnings: [] },
      prepComplete: true,
      projectArtifacts: [
        {
          id: "a1",
          type: "summary",
          title: "프로젝트 요약서",
          content: "# 프로젝트 요약\n\n본문",
          createdAt: nowIso,
          createdBy: "ai",
          sourceStage: "ideation",
          orchestration: { required: true, completeness: "full" },
        },
      ],
      envOk: false,
    });
    expect(state.hasReferenceArtifacts).toBe(true);
    expect(state.seedReady).toBe(true);
    expect(state.envOk).toBe(false);
  });
});

describe("quickDesignPostConfirmChipLabelsForState", () => {
  it("hides work plan draft CTA when env is not ready", () => {
    const chips = quickDesignPostConfirmChipLabelsForState({
      seedReady: true,
      designOk: true,
      envOk: false,
      hasReferenceArtifacts: true,
    });
    expect(chips).not.toContain("구현 작업안 초안 생성");
    expect(chips[0]).toBe(IMPLEMENTATION_ENV_SETTINGS_LABEL);
    expect(chips).toContain("구현단계로 이동");
  });

  it("hides implementation navigation when seed is not ready", () => {
    const chips = quickDesignPostConfirmChipLabelsForState({
      seedReady: false,
      designOk: true,
      envOk: true,
      hasReferenceArtifacts: true,
    });
    expect(chips).not.toContain("구현단계로 이동");
    expect(chips).toContain("Seed 후보 확인/확정");
  });

  it("shows implementation navigation when fully ready", () => {
    const chips = quickDesignPostConfirmChipLabelsForState({
      seedReady: true,
      designOk: true,
      envOk: true,
      hasReferenceArtifacts: true,
    });
    expect(chips).toContain("구현단계로 이동");
    expect(chips[0]).toBe("구현단계로 이동");
    expect(chips).not.toContain("구현 작업안 초안 생성");
  });
});

describe("resolveQuickDesignImplementationReadyCopy", () => {
  it("uses planning/seed heading when env is not ready", () => {
    const copy = resolveQuickDesignImplementationReadyCopy({
      state: { seedReady: true, designOk: true, envOk: false, hasReferenceArtifacts: true },
      autoConfirmedRequired: true,
    });
    expect(copy.heading).toBe("기획/Seed 준비가 완료되었습니다.");
    expect(copy.intro).toContain("환경 설정");
  });

  it("uses full implementation heading when env is ready", () => {
    const copy = resolveQuickDesignImplementationReadyCopy({
      state: { seedReady: true, designOk: true, envOk: true, hasReferenceArtifacts: true },
      autoConfirmedRequired: true,
    });
    expect(copy.heading).toBe("구현 작업 준비가 완료되었습니다.");
    expect(copy.intro).toContain("준비된 작업목록을 기준으로 구현을 시작할 수 있습니다");
  });
});

describe("implementationTaskList formatting", () => {
  it("formatImplementationTaskListSummarySection returns empty without tasks", () => {
    expect(formatImplementationTaskListSummarySection(null)).toEqual([]);
  });

  it("formatImplementationTaskListRoleSummaryLines lists role counts", () => {
    const lines = formatImplementationTaskListRoleSummaryLines({
      version: "implementation_task_list_v1",
      projectId: "p1",
      createdAt: nowIso,
      updatedAt: nowIso,
      source: "implementation_seed",
      tasks: [
        {
          taskId: "t1",
          title: "화면",
          description: "d",
          taskType: "screen",
          ownerRole: "developer",
          priority: "high",
          dependencies: [],
          acceptanceCriteria: [],
          status: "ready",
        },
      ],
      roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
    });
    expect(lines[0]).toContain("전체 작업: 1개");
    expect(lines[1]).toContain("AI 개발자: 1개");
  });
});

describe("implementationUxLabels chip registry", () => {
  it("puts env settings first when env is not ready", () => {
    const chips = implementationTaskListEntryChipLabels({ envOk: false });
    expect(chips[0]).toBe(IMPLEMENTATION_ENV_SETTINGS_LABEL);
  });
});
