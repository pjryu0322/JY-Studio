import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectKnowledgeRuntimeStatusCard } from "@/components/project-graph/ProjectKnowledgeRuntimeStatusCard";

describe("ProjectKnowledgeRuntimeStatusCard", () => {
  it("shows preparing empty copy", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeRuntimeStatusCard, {
        summary: {
          status: "PREPARING",
          statusLabel: "준비 중",
          nodeCount: 0,
          edgeCount: 0,
        },
        loading: false,
        error: null,
      }),
    );
    expect(html).toContain("knowledge-runtime-status-card");
    expect(html).toContain("아직 구조화된 항목이 없습니다.");
    expect(html).not.toContain("pipelineRunId");
  });

  it("shows ready summary without technical ids", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeRuntimeStatusCard, {
        summary: {
          status: "READY",
          statusLabel: "구조화 완료",
          nodeCount: 12,
          edgeCount: 10,
          latestChangeTitle: "추천안 승인",
          latestChangedAt: "2026-06-24T14:32:00.000Z",
          referenceEligibilityLabel: "참조 가능",
        },
        loading: false,
        error: null,
      }),
    );
    expect(html).toContain("구조화 완료");
    expect(html).toContain("항목 12개 · 연결 10개");
    expect(html).toContain("최근 변경: 추천안 승인");
    expect(html).toContain("마지막 반영:");
    expect(html).toContain("참조 준비: 참조 가능");
  });

  it("shows partial reference hint", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeRuntimeStatusCard, {
        summary: {
          status: "READY",
          statusLabel: "구조화 완료",
          nodeCount: 4,
          edgeCount: 3,
          referenceEligibilityLabel: "일부 참조 가능",
          referenceEligibilityHint: "승인된 기능과 흐름이 더 필요할 수 있습니다.",
        },
        loading: false,
        error: null,
      }),
    );
    expect(html).toContain("참조 준비: 일부 참조 가능");
    expect(html).toContain("승인된 기능과 흐름이 더 필요할 수 있습니다.");
  });

  it("shows error state", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeRuntimeStatusCard, {
        summary: null,
        loading: false,
        error: "fail",
      }),
    );
    expect(html).toContain("상태를 불러오지 못했습니다.");
  });

  it("shows loading state", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeRuntimeStatusCard, {
        summary: null,
        loading: true,
        error: null,
      }),
    );
    expect(html).toContain("불러오는 중");
  });
});
