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
        },
        loading: false,
        error: null,
      }),
    );
    expect(html).toContain("구조화 완료");
    expect(html).toContain("항목 12개 · 연결 10개");
    expect(html).toContain("최근 변경: 추천안 승인");
    expect(html).toContain("마지막 반영:");
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
