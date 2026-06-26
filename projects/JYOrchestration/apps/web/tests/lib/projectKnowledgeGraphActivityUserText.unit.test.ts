import { describe, expect, it } from "vitest";
import { toUserFriendlyGraphActivityLine } from "@/lib/project-graph/projectKnowledgeGraphActivityUserText";
import type { ProjectGraphActivityFeedRow } from "@/lib/project-graph/projectGraphActivityClient";

function row(partial: Partial<ProjectGraphActivityFeedRow> & Pick<ProjectGraphActivityFeedRow, "line">): ProjectGraphActivityFeedRow {
  return {
    id: "1",
    at: "15:36",
    sourceMessageId: null,
    line: partial.line,
    detail: partial.detail ?? { view: "default" },
    ...partial,
  };
}

describe("toUserFriendlyGraphActivityLine", () => {
  it("maps planning snapshot and conversation lines", () => {
    expect(
      toUserFriendlyGraphActivityLine(
        row({
          line: "Planning Snapshot 생성",
          detail: { view: "planning_snapshot" },
        }),
      ),
    ).toBe("프로젝트 아이디어가 구조화되었습니다.");
    expect(toUserFriendlyGraphActivityLine(row({ line: "원본 대화 저장" }))).toBe("대화 내용이 저장되었습니다.");
  });

  it("maps grouped candidate counts", () => {
    expect(
      toUserFriendlyGraphActivityLine(
        row({
          line: "Requirement 후보 3개 생성",
          detail: { view: "group_summary", groupSummary: { nodeType: "Requirement", count: 3 } },
        }),
      ),
    ).toBe("요구사항 3개가 정리되었습니다.");
  });
});
