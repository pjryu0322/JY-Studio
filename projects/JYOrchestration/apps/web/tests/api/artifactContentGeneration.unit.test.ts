import { describe, expect, it } from "vitest";
import {
  buildRichArtifactContent,
  evaluateArtifactContentQuality,
  isPlaceholderOnlyArtifactContent,
} from "@/lib/requirements/artifactContentGeneration";
import { generateProjectArtifact } from "@/lib/requirements/projectArtifactGenerate";
import { evaluateImplementationStartReadiness } from "@/lib/requirements/planningReadinessGate";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

const nowIso = "2026-05-24T12:00:00.000Z";

function confirmedOrchestration(projectName: string) {
  const definitions = buildDynamicServicePlanningSlotDefinitions({
    projectId: "p1",
    projectName,
  });
  const base = initialOrchestrationStateFromDefinitions(definitions, nowIso);
  const slots = { ...base.slots };
  const suffixes = [
    ".planning.servicePurpose",
    ".planning.coreUsers",
    ".planning.problem",
    ".planning.expectedOutcome",
    ".flow.actorTypes",
    ".flow.serviceFlow",
    ".design.coreFeatures",
    ".design.requiredScreens",
  ];
  for (const suffix of suffixes) {
    const key = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
    if (!key || !slots[key]) continue;
    slots[key] = {
      ...slots[key],
      status: "confirmed",
      value:
        suffix === ".design.coreFeatures"
          ? "녹취 업로드, 요약 생성, TODO 추출"
          : suffix === ".design.requiredScreens"
            ? "업로드 화면, 결과 화면, 검수 화면"
            : `${suffix} 확정`,
      updatedAt: nowIso,
    };
  }
  return { definitions, orchestration: { ...base, slots } };
}

describe("artifactContentGeneration", () => {
  it("does not treat placeholder-only artifact as complete", () => {
    const placeholder = [
      "# 회의록 — 기능 정의서",
      "",
      "구현 단계: IDEATION",
      "",
      "_기능 정의 슬롯이 아직 비어 있습니다. 세부 기능 정의를 진행한 뒤 다시 생성해 주세요._",
    ].join("\n");

    expect(isPlaceholderOnlyArtifactContent(placeholder)).toBe(true);
    const quality = evaluateArtifactContentQuality({
      artifactType: "feature-spec",
      content: placeholder,
    });
    expect(quality.isPlaceholderOnly).toBe(true);
    expect(quality.completenessScore).toBeLessThan(0.55);
  });

  it("generates feature definitions from orchestration context", () => {
    const { definitions, orchestration } = confirmedOrchestration("회의록 자동 정리");
    const content = buildRichArtifactContent({
      artifactType: "feature-spec",
      projectName: "회의록 자동 정리",
      projectDescription: "회의 녹취를 요약하는 서비스",
      sourceStage: "IDEATION",
      serviceFlow: null,
      featurePlanning: null,
      slotContext: {
        projectId: "p1",
        projectName: "회의록 자동 정리",
        projectDescription: "회의 녹취를 요약하는 서비스",
        conversationMessages: [],
        serviceFlow: null,
        orchestration,
        slotDefinitions: definitions,
        featurePlanning: null,
        problemInterview: null,
        sourceStage: "IDEATION",
      },
    });

    expect(content).toContain("기능 정의서");
    expect(content).toContain("## 핵심 기능");
    expect(content).not.toContain("아직 비어 있습니다");
    expect((content.match(/^###\s/gm) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("generates screen definitions from service flow", () => {
    const { definitions, orchestration } = confirmedOrchestration("회의록");
    const serviceFlow: RequirementsServiceFlowV1 = {
      createdAt: nowIso,
      updatedAt: nowIso,
      actors: [{ id: "user", name: "사용자", kind: "human" }],
      steps: [
        { id: "s1", order: 1, title: "녹취 업로드", purpose: "파일 등록", primaryActorId: "user" },
        { id: "s2", order: 2, title: "요약 결과 확인", purpose: "검토", primaryActorId: "user" },
      ],
    };
    const content = buildRichArtifactContent({
      artifactType: "screen-spec",
      projectName: "회의록",
      projectDescription: "회의 요약",
      sourceStage: "IDEATION",
      serviceFlow,
      featurePlanning: null,
      slotContext: {
        projectId: "p1",
        projectName: "회의록",
        projectDescription: "회의 요약",
        conversationMessages: [],
        serviceFlow,
        orchestration,
        slotDefinitions: definitions,
        featurePlanning: null,
        problemInterview: null,
        sourceStage: "IDEATION",
      },
      memberDrafts: [
        {
          role: "designer",
          content: "대시보드, 업로드, 결과 상세",
          agentId: "d",
          runId: "r",
          flowId: "fast_plan_draft",
        },
      ],
    });

    expect(content).toContain("화면 정의서");
    expect(content).toContain("## 주요 화면");
    expect(content).not.toContain("아직 없습니다");
    expect((content.match(/^###\s/gm) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("blocks implementation start when artifacts are incomplete", () => {
    const { definitions, orchestration } = confirmedOrchestration("회의록");
    const placeholderArtifact = generateProjectArtifact({
      artifactType: "feature-spec",
      projectName: "회의록",
      sourceStage: "IDEATION",
      nowIso,
      contentOverride: "_기능 정의 슬롯이 아직 비어 있습니다._",
    });

    const readiness = evaluateImplementationStartReadiness({
      orchestration,
      definitions,
      projectArtifacts: [placeholderArtifact],
      artifactOrchestrationV1: {
        plannedAt: nowIso,
        serviceProfile: "standard",
        requiredTypes: ["feature-spec", "summary"],
        planned: [],
        memberRoles: ["planner"],
        planningSummary: "test",
      },
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.missingRequiredArtifactTypes.length + (readiness.reason?.length ?? 0)).toBeGreaterThan(0);
  });
});
