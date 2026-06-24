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
    expect(html).toContain("그래프 변화");
  });

  it("renders revision titles without technical ids", () => {
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
        diffLines: ["+ 노드 2개 추가"],
      }),
    );
    expect(html).toContain("추천안 승인");
    expect(html).not.toContain("uuid-hidden");
    expect(html).toContain("knowledge-replay-diff");
    expect(html).toContain("+ 노드 2개 추가");
  });
});
