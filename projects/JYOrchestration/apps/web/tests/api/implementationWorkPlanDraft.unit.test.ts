import { describe, expect, it } from "vitest";
import {
  buildConfirmImplementationTaskPlanResult,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import { buildGenerateImplementationWorkPlanDraftResult } from "@/lib/prototype/prototypeExecutionWorkPlanDraftActions";
import { buildImplementationBootstrapBundle } from "@/lib/prototype/implementationOrchestrationSummary";
import {
  buildDerivedImplementationArtifacts,
} from "@/lib/prototype/implementationArtifacts";
import {
  collectReferencePlanningArtifacts,
  IMPLEMENTATION_ENTRY_READINESS_HEADLINE,
  implementationEntryChips,
  implementationWorkPlanDraftChips,
  WORK_PLAN_DRAFT_GENERATE_CHIP,
} from "@/lib/prototype/implementationWorkPlanDraft";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

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
  it("shows draft generation CTA before implementation work plan confirmation", () => {
    const chips = implementationEntryChips();
    expect(chips).toContain(WORK_PLAN_DRAFT_GENERATE_CHIP);
    expect(chips).not.toContain("구현 작업안 확정");
    expect(chips).not.toContain("구현 범위 수정");
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
    const gen = buildGenerateImplementationWorkPlanDraftResult({
      requirementsStateJson: {},
      projectId: "p1",
      projectArtifacts: planningArtifacts,
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
