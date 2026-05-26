import { describe, expect, it } from "vitest";
import {
  IMPLEMENTATION_RECOMMENDED_ARTIFACT_CATALOG,
  IMPLEMENTATION_REQUIRED_ARTIFACT_CATALOG,
  PLANNING_REQUIRED_ARTIFACT_CATALOG,
  REVIEW_RECOMMENDED_ARTIFACT_CATALOG,
  allArtifactBoardCatalogItems,
} from "@/lib/artifacts/artifactBoardCatalog";
import {
  isArtifactBoardStatusAvailable,
  isArtifactBoardStatusCompleted,
  isArtifactBoardStatusSelectable,
} from "@/lib/artifacts/artifactBoardStatus";
import {
  buildArtifactBoardItems,
  calculateArtifactBoardTabCounts,
  formatArtifactBoardTabCountLabel,
  summarizeArtifactBoardStatuses,
  type ArtifactBoardItem,
} from "@/lib/artifacts/buildArtifactBoardItems";
import { isArtifactContentMeaningful } from "@/lib/artifacts/artifactBoardStatus";
import { groupArtifactBoardItemsForDisplay, buildArtifactHubView } from "@/lib/prototype/artifactHubView";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const now = "2026-05-19T00:00:00.000Z";
const newer = "2026-05-20T12:00:00.000Z";
const older = "2026-05-18T12:00:00.000Z";

const seedFixture = {
  version: "implementation_seed_v1" as const,
  projectId: "p1",
  createdAt: older,
  updatedAt: older,
  lifecycleStatus: "confirmed" as const,
  readiness: { ready: true, score: 0.9, missing: [] as const },
  gaps: [],
  assumptions: [],
  processImplementationItems: [{ processName: "p1" }],
  screenImplementationItems: [{ screenName: "s1" }],
  actorCapabilityMatrix: [{ actor: "user", capabilities: ["read"] }],
  commonDetailFeatures: [],
  dataModelSeed: { entities: ["e1"], mockDataNotes: [] },
};

describe("artifactBoard catalog", () => {
  it("defines planning and implementation artifact board catalog items", () => {
    expect(PLANNING_REQUIRED_ARTIFACT_CATALOG.length).toBe(5);
    expect(IMPLEMENTATION_REQUIRED_ARTIFACT_CATALOG.length).toBeGreaterThanOrEqual(5);
    expect(allArtifactBoardCatalogItems().some((c) => c.stage === "planning")).toBe(true);
    expect(allArtifactBoardCatalogItems().some((c) => c.stage === "implementation")).toBe(true);
  });

  it("uses user-facing labels for implementation artifact catalog items", () => {
    const titles = IMPLEMENTATION_REQUIRED_ARTIFACT_CATALOG.map((c) => c.title);
    expect(titles).toContain("구현 준비정보");
    expect(titles).toContain("구현 준비도");
    expect(titles).toContain("AI개발자 작업 지시서");
    expect(titles).toContain("WIP 작업 결과");
    expect(titles).not.toContain("Implementation Seed");
    expect(titles).not.toContain("Code Agent 작업 지시서");
    const recommended = IMPLEMENTATION_RECOMMENDED_ARTIFACT_CATALOG.map((c) => c.title);
    expect(recommended).toContain("데이터 저장 방식 판단서");
    expect(recommended).not.toContain("DB 연동 판단서");
  });

  it("keeps review artifacts in review catalog while implementation recommended catalog contains implementation stage items only", () => {
    expect(IMPLEMENTATION_RECOMMENDED_ARTIFACT_CATALOG.every((c) => c.stage === "implementation")).toBe(
      true,
    );
    expect(REVIEW_RECOMMENDED_ARTIFACT_CATALOG.every((c) => c.stage === "review")).toBe(true);
    expect(REVIEW_RECOMMENDED_ARTIFACT_CATALOG.map((c) => c.title)).toEqual(
      expect.arrayContaining(["검수 기준서", "보안 기준서"]),
    );
    expect(allArtifactBoardCatalogItems().filter((c) => c.stage === "review").length).toBe(2);
  });
});

describe("artifactBoard status helpers", () => {
  it("counts only created status as completed in artifact board tab counts", () => {
    const items = [
      { status: "created" },
      { status: "needs_revision" },
      { status: "candidate" },
    ] as readonly ArtifactBoardItem[];
    const counts = calculateArtifactBoardTabCounts(items);
    expect(formatArtifactBoardTabCountLabel(counts.all)).toBe("1/3");
    expect(counts.all.created).toBe(1);
    expect(counts.all.total).toBe(3);
  });

  it("allows existing candidate and needs_revision artifacts to be opened or selected without counting them as completed", () => {
    expect(isArtifactBoardStatusCompleted("created")).toBe(true);
    expect(isArtifactBoardStatusCompleted("needs_revision")).toBe(false);
    expect(isArtifactBoardStatusCompleted("candidate")).toBe(false);
    expect(isArtifactBoardStatusAvailable("needs_revision")).toBe(true);
    expect(isArtifactBoardStatusSelectable("candidate")).toBe(true);
  });

  it("summarizes created, needs_revision, candidate, generatable, waiting separately", () => {
    const items = [
      { status: "created" },
      { status: "needs_revision" },
      { status: "candidate" },
      { status: "generatable" },
      { status: "waiting" },
    ] as readonly ArtifactBoardItem[];
    expect(summarizeArtifactBoardStatuses(items)).toBe(
      "생성완료 1 · 보완필요 1 · 후보 1 · 생성가능 1 · 생성대기 1",
    );
  });
});

describe("buildArtifactBoardItems", () => {
  it("marks catalog item as created when matching artifact exists with meaningful content", () => {
    const state: RequirementsStateJson = {
      projectArtifacts: [
        {
          id: "a1",
          type: "summary",
          title: "프로젝트 요약서",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 프로젝트 요약\n\n본문이 충분히 있습니다.",
        },
      ],
    };
    const items = buildArtifactBoardItems({
      projectId: "p1",
      projectArtifacts: state.projectArtifacts ?? [],
      requirementsStateJson: state,
      selectedStage: "planning",
    });
    const summary = items.find((i) => i.catalogId === "planning-summary");
    expect(summary?.status).toBe("created");
  });

  it("marks implementation artifacts as waiting when prerequisites are missing", () => {
    const items = buildArtifactBoardItems({
      projectId: "p1",
      projectArtifacts: [],
      requirementsStateJson: {},
      selectedStage: "implementation",
    });
    const workPlan = items.find((i) => i.catalogId === "impl-work-plan");
    expect(workPlan?.status).toBe("waiting");
    expect(workPlan?.generationCondition).toMatch(/기획/);
  });

  it("marks implementation work plan as generatable when implementation seed exists", () => {
    const state: RequirementsStateJson = {
      projectArtifacts: [
        {
          id: "fp",
          type: "fast_prototype_plan",
          title: "프로토타입 기획안",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 기획안\n\n충분한 내용",
        },
      ],
      implementationSeedV1: seedFixture,
    };
    const items = buildArtifactBoardItems({
      projectId: "p1",
      projectArtifacts: state.projectArtifacts ?? [],
      requirementsStateJson: state,
      selectedStage: "implementation",
    });
    const workPlan = items.find((i) => i.catalogId === "impl-work-plan");
    expect(workPlan?.status).toBe("generatable");
    expect(workPlan?.actions).toContain("generate_implementation_work_plan");
    expect(workPlan?.actions).not.toContain("generate_planning_artifact");
  });

  it("does not call planning artifact generate handler for implementation board items", () => {
    const state: RequirementsStateJson = {
      projectArtifacts: [
        {
          id: "fp",
          type: "fast_prototype_plan",
          title: "프로토타입 기획안",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 기획안\n\n충분한 내용",
        },
      ],
    };
    const items = buildArtifactBoardItems({
      projectId: "p1",
      projectArtifacts: state.projectArtifacts ?? [],
      requirementsStateJson: state,
      selectedStage: "implementation",
    });
    for (const item of items.filter((i) => i.stage === "implementation")) {
      expect(item.actions).not.toContain("generate_planning_artifact");
    }
    const seed = items.find((i) => i.catalogId === "impl-seed");
    expect(seed?.status).toBe("generatable");
    expect(seed?.actions).toContain("go_to_implementation");
  });

  it("marks implementation work plan as stale when planning artifacts are newer than the draft", () => {
    const state: RequirementsStateJson = {
      projectArtifacts: [
        {
          id: "fp",
          type: "fast_prototype_plan",
          title: "프로토타입 기획안",
          createdAt: newer,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 기획안\n\n충분한 내용입니다.",
        },
      ],
      implementationSeedV1: { ...seedFixture, updatedAt: older },
      implementationWorkPlanDraftV1: {
        version: "implementation_work_plan_draft_v1",
        projectId: "p1",
        createdAt: older,
        updatedAt: older,
        source: "implementation_seed",
        referenceArtifacts: [],
        implementationScope: ["로그인 화면 구현"],
        implementationApproach: ["단계적 구현"],
        assumptions: [],
        blockers: [],
        status: "draft",
        actorCapabilityMatrix: [{ actor: "user", capabilities: ["read"] }],
      },
    };
    const items = buildArtifactBoardItems({
      projectId: "p1",
      projectArtifacts: state.projectArtifacts ?? [],
      requirementsStateJson: state,
      selectedStage: "implementation",
    });
    const workPlan = items.find((i) => i.catalogId === "impl-work-plan");
    expect(workPlan?.status).toBe("stale");
    expect(workPlan?.generationCondition).toMatch(/기획 산출물/);
  });

  it("calculates artifact board tab counts as created over total targets", () => {
    const state: RequirementsStateJson = {
      projectArtifacts: [
        {
          id: "a1",
          type: "summary",
          title: "요약",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 요약서 본문",
        },
        {
          id: "a2",
          type: "feature-spec",
          title: "기능",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 기능 정의",
          orchestration: { completenessScore: 0.2, required: true, reason: "test", hubReadinessLabel: "ok" },
        },
      ],
    };
    const items = buildArtifactBoardItems({
      projectId: "p1",
      projectArtifacts: state.projectArtifacts ?? [],
      requirementsStateJson: state,
      selectedStage: "all",
    });
    const counts = calculateArtifactBoardTabCounts(items);
    expect(formatArtifactBoardTabCountLabel(counts.planning)).toMatch(/^\d+\/\d+$/);
    expect(counts.planning.total).toBe(6);
    expect(counts.planning.created).toBe(1);
    expect(counts.implementation.total).toBeGreaterThanOrEqual(5);
    expect(counts.implementation.created).toBe(0);
    expect(counts.all.created).toBe(1);
    expect(counts.all.total).toBeGreaterThanOrEqual(10);
  });

  it("does not show planning artifacts as cards in implementation tab", () => {
    const view = buildArtifactHubView({
      mode: "implementation",
      state: {
        projectArtifacts: [
          {
            id: "a1",
            type: "summary",
            title: "요약",
            createdAt: now,
            createdBy: "ai",
            sourceStage: "IDEATION",
            content: "# 요약",
          },
        ],
      },
      projectId: "p1",
    });
    const implSection = groupArtifactBoardItemsForDisplay(view, "implementation");
    const implItems = implSection.sections.flatMap((s) => s.items);
    expect(implItems.every((i) => i.stage === "implementation" || i.stage === "review")).toBe(true);
    expect(implItems.some((i) => i.catalogId.startsWith("planning-"))).toBe(false);
  });

  it("hides download actions for missing artifacts", () => {
    const items = buildArtifactBoardItems({
      projectId: "p1",
      projectArtifacts: [],
      requirementsStateJson: {},
      selectedStage: "planning",
    });
    const summary = items.find((i) => i.catalogId === "planning-summary");
    expect(summary?.actions).not.toContain("download_doc");
    expect(summary?.actions).not.toContain("download_pdf");
    expect(summary?.actions).toContain("generate_planning_artifact");
  });
});

describe("isArtifactContentMeaningful", () => {
  it("rejects empty placeholder content", () => {
    expect(isArtifactContentMeaningful("")).toBe(false);
    expect(isArtifactContentMeaningful("short")).toBe(false);
  });
});
