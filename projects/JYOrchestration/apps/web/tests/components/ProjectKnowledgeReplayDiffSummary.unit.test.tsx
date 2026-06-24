import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectKnowledgeReplayDiffSummary } from "@/components/project-graph/ProjectKnowledgeReplayDiffSummary";

describe("ProjectKnowledgeReplayDiffSummary", () => {
  it("shows overflow message when more than three changes", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeReplayDiffSummary, {
        lines: [
          "+ 항목 1개 추가",
          "+ 연결 1개 추가",
          "+ 항목 2개 추가",
          "- 항목 1개 제거",
        ],
      }),
    );
    expect(html).toContain("이번 변경");
    expect(html).toContain("knowledge-replay-diff-overflow");
    expect(html).toContain("외 1개 변경 더 있음");
  });
});
