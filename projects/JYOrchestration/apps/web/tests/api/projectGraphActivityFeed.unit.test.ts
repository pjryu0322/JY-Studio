import { describe, expect, it } from "vitest";
import { buildProjectGraphActivityFeed } from "@/lib/project-graph/projectGraphActivityFeed";
import { planningSnapshotPayloadFromModel } from "@/lib/planning-snapshot/planningSnapshotMapper";
import { PLANNING_SNAPSHOT_EVENT_TYPE } from "@/lib/planning-snapshot/planningSnapshotModel";

describe("buildProjectGraphActivityFeed", () => {
  const payload = planningSnapshotPayloadFromModel({
    projectId: "p1",
    productName: "회의록 자동 정리 서비스",
    summary: "녹음 파일을 업로드하면 AI가 화자별 스크립트와 회의 요약을 제공합니다.",
    problems: ["회의록 작성 시간 과다"],
    actors: ["관리자", "팀 리더"],
    features: ["화자별 스크립트", "회의록 목록"],
    scope: { included: [], excluded: [] },
    successCriteria: [],
    sourceMessageId: "msg-1",
    createdBy: "AI Planner",
  });

  it("groups planning snapshot candidates and exposes user-friendly snapshot detail", () => {
    const createdAt = "2026-06-23T13:17:00.000Z";
    const feed = buildProjectGraphActivityFeed({
      projectId: "p1",
      events: [
        {
          id: "ev-1",
          eventType: PLANNING_SNAPSHOT_EVENT_TYPE,
          createdAt,
          sourceMessageId: "msg-1",
          stage: "REQUIREMENTS_IDEATION",
          payload,
        },
        {
          id: "ev-0",
          eventType: "conversation.message_created",
          createdAt,
          sourceMessageId: "msg-1",
          payload: { messageId: "msg-1" },
        },
      ],
      candidates: [
        {
          id: "c1",
          nodeType: "Requirement",
          title: "요구: 화자별",
          createdAt,
          sourceMessageId: "msg-1",
          metadata: { planningSnapshot: true },
        },
        {
          id: "c2",
          nodeType: "Requirement",
          title: "요구: 목록",
          createdAt,
          sourceMessageId: "msg-1",
          metadata: { planningSnapshot: true },
        },
        {
          id: "c3",
          nodeType: "Feature",
          title: "화자별 스크립트",
          createdAt,
          sourceMessageId: "msg-1",
          metadata: { planningSnapshot: true },
        },
      ],
      graphNodes: [
        { id: "n1", metadata: { planningSnapshot: true, sourceMessageId: "msg-1" } },
      ],
      graphEdges: [{ id: "e1", metadata: { planningSnapshot: true } }],
    });

    expect(feed.some((r) => r.line === "Planning Snapshot 생성")).toBe(true);
    expect(feed.some((r) => r.line === "원본 대화 저장")).toBe(true);
    expect(feed.some((r) => r.line === "Requirement 후보 2개 생성")).toBe(true);
    expect(feed.some((r) => r.line === "Feature 후보 1개 생성")).toBe(true);
    expect(feed.some((r) => r.line === "Graph Edge 1개 생성")).toBe(true);
    expect(feed.some((r) => r.line.includes("Candidate: Requirement"))).toBe(false);

    const snapshotRow = feed.find((r) => r.line === "Planning Snapshot 생성");
    expect(snapshotRow?.detail.view).toBe("planning_snapshot");
    expect(snapshotRow?.detail.planningSnapshot?.productName).toBe("회의록 자동 정리 서비스");
    expect(snapshotRow?.detail.rawPayloadJson).toContain("회의록");
    expect(snapshotRow?.detail.planningSnapshot?.requirementsHref).toContain("sourceMessageId=msg-1");
    expect(snapshotRow?.detail.planningSnapshot?.statusBadges).toContain("Candidate 생성 완료");
  });
});
