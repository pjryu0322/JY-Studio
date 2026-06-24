import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectKnowledgeReplayTimeline } from "@/components/project-graph/ProjectKnowledgeReplayTimeline";

describe("ProjectKnowledgeReplayTimeline", () => {
  it("shows empty state in Korean", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeReplayTimeline, {
        revisions: [],
        selectedIndex: 0,
        onSelectIndex: () => {},
        diffLines: [],
      }),
    );
    expect(html).toContain("knowledge-replay-empty");
    expect(html).toContain("아직 표시할 변화 이력이 없습니다.");
    expect(html).toContain("기획 대화를 진행하거나");
  });

  it("renders revision titles without technical ids and user-friendly diff", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeReplayTimeline, {
        revisions: [
          {
            id: "uuid-hidden",
            revisionNumber: 1,
            title: "추천안 승인",
            summary: "AI 추천안이 승인되어 기록에 반영되었습니다.",
            nodeCount: 2,
            edgeCount: 1,
            createdAt: "2026-06-24T10:12:00.000Z",
          },
        ],
        selectedIndex: 0,
        onSelectIndex: () => {},
        diffLines: ["+ 항목 2개 추가", "+ 연결 3개 추가"],
        changeHintsByIndex: ["항목 2개 추가 · 연결 3개 추가"],
      }),
    );
    expect(html).toContain("추천안 승인");
    expect(html).not.toContain("uuid-hidden");
    expect(html).toContain("knowledge-replay-diff");
    expect(html).toContain("이번 변경");
    expect(html).toContain("+ 항목 2개 추가");
    expect(html).not.toContain("uuid-hidden");
    expect(html).not.toContain("nodeId");
    expect(html).not.toContain("revisionId");
  });

  it("truncates long diff lists", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeReplayTimeline, {
        revisions: [
          {
            id: "r1",
            revisionNumber: 1,
            title: "대화 저장",
            summary: null,
            nodeCount: 1,
            edgeCount: 0,
            createdAt: "2026-06-24T10:10:00.000Z",
          },
        ],
        selectedIndex: 0,
        onSelectIndex: () => {},
        diffLines: [
          "+ 항목 1개 추가",
          "+ 연결 1개 추가",
          "+ 항목 2개 추가",
          "- 항목 1개 제거",
          "+ 연결 2개 추가",
        ],
      }),
    );
    expect(html).toContain("knowledge-replay-diff-overflow");
    expect(html).toContain("외 2개 변경 더 있음");
  });
});
