import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KnowledgePipelineMonitorPanel } from "@/components/project-graph/KnowledgePipelineMonitorPanel";

describe("KnowledgePipelineMonitorPanel trace entry", () => {
  it("shows 생성 과정 보기 button without nodeId in copy", () => {
    const html = renderToStaticMarkup(
      createElement(KnowledgePipelineMonitorPanel, {
        runs: [],
        loading: false,
        error: null,
        onRefresh: vi.fn(),
        traceNodeId: null,
        onOpenTrace: vi.fn(),
      }),
    );
    expect(html).toContain("생성 과정 보기");
    expect(html).toContain("knowledge-activity-open-trace");
    expect(html).not.toContain("node-");
    expect(html).toContain("그래프에서 항목을 선택하면");
  });

  it("shows node title when traceNodeTitle provided", () => {
    const html = renderToStaticMarkup(
      createElement(KnowledgePipelineMonitorPanel, {
        runs: [],
        loading: false,
        error: null,
        onRefresh: vi.fn(),
        traceNodeId: "hidden-id",
        traceNodeTitle: "회의록 업로드",
        onOpenTrace: vi.fn(),
      }),
    );
    expect(html).toContain("회의록 업로드");
    expect(html).not.toContain("hidden-id");
  });

  it("disables trace button without traceNodeId", () => {
    const html = renderToStaticMarkup(
      createElement(KnowledgePipelineMonitorPanel, {
        runs: [],
        loading: false,
        error: null,
        onRefresh: vi.fn(),
        traceNodeId: null,
        onOpenTrace: vi.fn(),
      }),
    );
    expect(html).toContain('disabled=""');
  });
});
