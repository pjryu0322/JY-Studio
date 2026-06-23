import { describe, expect, it } from "vitest";
import { mapPlanningSnapshotFromRequirementsContext } from "@/lib/planning-snapshot/planningSnapshotMapper";
import { planProjectGraphProjectionFromEvent } from "@/lib/project-graph/projectGraphProjectionPlan";
import { PROJECT_GRAPH_EVENT_TYPES, PROJECT_GRAPH_NODE_TYPES } from "@/lib/project-graph/projectGraphTypes";
import { planStructureCandidatesFromEvent } from "@/lib/project-structure/projectStructureExtractorPlan";
import { planningSnapshotPayloadFromModel } from "@/lib/planning-snapshot/planningSnapshotMapper";

describe("planning snapshot mapper", () => {
  it("maps orchestration slots into snapshot fields", () => {
    const snapshot = mapPlanningSnapshotFromRequirementsContext({
      projectId: "p1",
      projectName: "회의록 서비스",
      projectDescription: "녹음 기반 회의록",
      sourceMessageId: "msg-1",
      state: {
        priorityFeatures: "- 회의록 목록\n- 화자별 스크립트",
        originalProjectDescription: "회의록 자동화",
      },
      orchestration: {
        slotDefinitionsHash: "h",
        slots: {
          "p.planning.servicePurpose": { status: "candidate", value: "회의록 자동 생성", confidence: 0.5 },
          "p.planning.coreUsers": { status: "candidate", value: "관리자, 팀 리더", confidence: 0.5 },
          "p.planning.problem": { status: "candidate", value: "회의록 작성 시간 과다", confidence: 0.5 },
        },
      },
      definitions: [
        { slotKey: "p.planning.servicePurpose", label: "목적", ownerAgent: "planner" },
        { slotKey: "p.planning.coreUsers", label: "사용자", ownerAgent: "planner" },
        { slotKey: "p.planning.problem", label: "문제", ownerAgent: "planner" },
      ],
    });
    expect(snapshot.productName).toBe("회의록 서비스");
    expect(snapshot.problems[0]).toContain("회의록");
    expect(snapshot.actors).toContain("관리자");
    expect(snapshot.features.length).toBeGreaterThan(0);
  });
});

describe("planning.snapshot_created projection", () => {
  const payload = planningSnapshotPayloadFromModel({
    projectId: "p1",
    productName: "회의록 서비스",
    summary: "한 줄 소개",
    problems: ["회의록 작성 시간 과다"],
    actors: ["관리자", "팀 리더"],
    features: ["화자별 스크립트"],
    scope: { included: [], excluded: [] },
    successCriteria: [],
    sourceMessageId: "msg-9",
    createdBy: "AI Planner",
  });

  it("projects graph nodes for idea, actors, and features", () => {
    const plan = planProjectGraphProjectionFromEvent({
      id: "ev-1",
      projectId: "p1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED,
      payload,
      sourceMessageId: "msg-9",
    });
    const types = plan.nodes.map((n) => n.nodeType);
    expect(types).toContain(PROJECT_GRAPH_NODE_TYPES.IDEA);
    expect(types).toContain(PROJECT_GRAPH_NODE_TYPES.ACTOR);
    expect(types).toContain(PROJECT_GRAPH_NODE_TYPES.FEATURE);
    expect(plan.edges.length).toBeGreaterThan(0);
  });

  it("creates structure candidates with explainability metadata", () => {
    const plan = planStructureCandidatesFromEvent({
      id: "ev-1",
      projectId: "p1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED,
      payload,
      sourceMessageId: "msg-9",
    });
    expect(plan.nodes.some((n) => n.nodeType === "Actor")).toBe(true);
    expect(plan.nodes.some((n) => n.nodeType === "Feature")).toBe(true);
    const actor = plan.nodes.find((n) => n.nodeType === "Actor");
    const meta = actor?.metadata as { explainability?: { reason?: string } };
    expect(meta?.explainability?.reason).toContain("AI 기획자");
  });
});
