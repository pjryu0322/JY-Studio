import { describe, expect, it } from "vitest";
import {
  buildGenerateImplementationWorkPlanDraftResult,
} from "@/lib/prototype/prototypeExecutionWorkPlanDraftActions";
import {
  buildImplementationBootstrapBundle,
  hasAnyValidImplementationBootstrap,
  hasValidImplementationBlockedBootstrap,
  hasValidImplementationLeadBootstrap,
  IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_HEADLINE,
  implementationEntryChipsForBootstrap,
  sanitizeImplementationConversationMessages,
} from "@/lib/prototype/implementationOrchestrationSummary";
import {
  IMPLEMENTATION_BLOCKED_RETURN_TO_PLANNING_CHIP,
  IMPLEMENTATION_ENTRY_READINESS_HEADLINE,
  implementationBlockedEntryChips,
} from "@/lib/prototype/implementationWorkPlanDraft";
import { tryHandlePrototypeExecutionChip } from "@/lib/prototype/prototypeExecutionImplementationChips";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

const baseInput = {
  projectId: "p1",
  env: { git: "ok", github: "needs", cursor: "error", connectionTest: "needs" } as const,
  envOk: false,
  envSettingsHref: "/settings#execution",
  featureDraftTitles: ["업로드"],
  projectArtifacts: [] as readonly ProjectArtifact[],
  artifactOrchestrationV1: null,
  designOk: true,
};

const planningArtifacts: readonly ProjectArtifact[] = [
  {
    id: "a1",
    type: "fast_prototype_plan",
    title: "프로토타입 기획안",
    content: "# plan",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "ai",
    sourceStage: "IDEATION",
  },
];

describe("implementation blocked when no planning artifacts", () => {
  it("blocks implementation entry when no planning artifacts exist", () => {
    const bundle = buildImplementationBootstrapBundle(baseInput);
    expect(bundle.messages).toHaveLength(1);
    expect(bundle.messages[0]?.content).toContain(IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_HEADLINE);
    expect(bundle.messages[0]?.content).not.toContain(IMPLEMENTATION_ENTRY_READINESS_HEADLINE);
    expect(bundle.messages[0]?.content).not.toContain("참조 기획 산출물:");
    expect(bundle.messages[0]?.content).not.toContain("역할별 점검 요약");
    expect(bundle.messages[0]?.content).not.toContain("SCM 점검 결과");
    expect(hasValidImplementationBlockedBootstrap(bundle.messages)).toBe(true);
    expect(hasValidImplementationLeadBootstrap(bundle.messages)).toBe(false);
  });

  it("shows only return-to-planning CTA when implementation is blocked by missing planning artifacts", () => {
    const bundle = buildImplementationBootstrapBundle(baseInput);
    const chips = bundle.messages[0]?.meta.interviewSuggestions ?? [];
    expect(chips).toEqual(["기획단계로 돌아가기"]);
    expect(chips).toEqual([...implementationBlockedEntryChips()]);
    expect(chips).not.toContain("기획 산출물 생성");
    expect(chips).not.toContain("산출물 다시 보기");
    expect(chips).not.toContain("구현 작업안 초안 생성");
    expect(chips).not.toContain("역할별 점검 보기");
    expect(chips).not.toContain("구현 범위 직접 입력");
    expect(bundle.messages[0]?.meta.interviewAllowCustomInput).toBe(false);
  });

  it("guides users to prepare planning conversation and artifacts when implementation is blocked", () => {
    const bundle = buildImplementationBootstrapBundle(baseInput);
    const content = bundle.messages[0]?.content ?? "";
    expect(content).toContain("기획단계에서 대화와 산출물을 준비해 주세요.");
    expect(content).not.toContain("기획단계에서 산출물을 생성해 주세요.");
  });

  it("routes return-to-planning chip from implementation blocked state", () => {
    let navigated = false;
    expect(
      tryHandlePrototypeExecutionChip(IMPLEMENTATION_BLOCKED_RETURN_TO_PLANNING_CHIP, {
        openEnvSettings: () => {},
        returnToPlanningStage: () => {
          navigated = true;
        },
        focusComposerForScopeEdit: () => {},
        showRoleCheckDetails: () => {},
        generateImplementationWorkPlanDraft: () => {},
        confirmImplementationTaskPlan: () => {},
        requestCodeAgentWipWork: () => {},
        viewWipChanges: () => {},
        requestRefactor: () => {},
        requestAdditionalEdit: () => {},
        approveDeveloperResult: () => {},
        discardWipWork: () => {},
        requestScmOfficialCommit: () => {},
        reviewDbIntegrationNeed: () => {},
        generateDataModelDraft: () => {},
        confirmMockImplementationMode: () => {},
        prepareImplementationExecution: () => {},
        confirmExecution: () => {},
        refreshStatus: () => {},
        showToast: () => {},
        canConfirmImplementationTaskPlan: () => false,
        canRequestCodeAgentWipWork: () => false,
        canApproveDeveloperResult: () => false,
        canRequestScmOfficialCommit: () => false,
        canConfirmExecution: () => false,
      }),
    ).toBe(true);
    expect(navigated).toBe(true);
  });

  it("shows normal implementation bootstrap when planning artifacts exist", () => {
    const bundle = buildImplementationBootstrapBundle({
      ...baseInput,
      projectArtifacts: planningArtifacts,
      env: { git: "ok", github: "ok", cursor: "ok", connectionTest: "ok" },
      envOk: true,
    });
    expect(bundle.messages[0]?.content).toContain(IMPLEMENTATION_ENTRY_READINESS_HEADLINE);
    expect(bundle.messages[0]?.content).toContain("참조 기획 산출물:");
    expect(hasValidImplementationLeadBootstrap(bundle.messages)).toBe(true);
    expect(hasValidImplementationBlockedBootstrap(bundle.messages)).toBe(false);
    expect(bundle.messages[0]?.meta.interviewSuggestions).toEqual(
      expect.arrayContaining([
        ...implementationEntryChipsForBootstrap({
          ...baseInput,
          projectArtifacts: planningArtifacts,
          env: { git: "ok", github: "ok", cursor: "ok", connectionTest: "ok" },
          envOk: true,
        }),
      ]),
    );
  });

  it("does not recreate blocked implementation bootstrap repeatedly", () => {
    const bundle = buildImplementationBootstrapBundle(baseInput);
    expect(hasAnyValidImplementationBootstrap(bundle.messages)).toBe(true);
    const again = buildImplementationBootstrapBundle(baseInput);
    expect(hasValidImplementationBlockedBootstrap([...bundle.messages, ...again.messages])).toBe(true);
  });

  it("keeps blocked implementation bootstrap during sanitize", () => {
    const bundle = buildImplementationBootstrapBundle(baseInput);
    const sanitized = sanitizeImplementationConversationMessages(bundle.messages);
    expect(sanitized).toHaveLength(1);
    expect(hasValidImplementationBlockedBootstrap(sanitized)).toBe(true);
  });

  it("does not generate implementation work plan draft without planning artifacts", () => {
    const result = buildGenerateImplementationWorkPlanDraftResult({
      requirementsStateJson: {},
      projectId: "p1",
      projectArtifacts: [],
      envOk: true,
      designOk: true,
    });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") {
      expect(result.message).toContain("기획 산출물이 없어");
    }
  });
});
