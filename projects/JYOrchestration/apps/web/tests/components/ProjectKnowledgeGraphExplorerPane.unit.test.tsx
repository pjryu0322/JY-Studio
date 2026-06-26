import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectKnowledgeGraphExplorerPane } from "@/components/project-graph/ProjectKnowledgeGraphExplorerPane";

vi.mock("@/components/layout/WorkspaceModeContext", () => ({
  useWorkspaceMode: () => ({ effectiveLayout: "DESKTOP" }),
}));

const explorerStub = {
  graphMobileUx: false,
  toastMessage: null,
  contextMenu: {
    menu: { open: false, kind: "canvas" as const, x: 0, y: 0 },
    actionSheetNodeId: null,
    openNodeMenu: vi.fn(),
    openCanvasMenu: vi.fn(),
    openNodeActionSheet: vi.fn(),
    close: vi.fn(),
  },
  selectedNodeId: null,
  detailNodeId: null,
  focusNodeId: null,
  selectedEdgeId: null,
  selectedNode: null,
  detailNode: null,
  selectedEdge: null,
  nodeTitleById: new Map(),
  selectionImpact: null,
  detailImpact: null,
  search: "",
  setSearch: vi.fn(),
  nodeTypeFilter: "",
  setNodeTypeFilter: vi.fn(),
  lifecycleFilter: "",
  setLifecycleFilter: vi.fn(),
  edgeTypeFilter: "",
  setEdgeTypeFilter: vi.fn(),
  nodeTypes: [],
  filteredNodes: [],
  filteredEdges: [],
  explored: { nodes: [], highlightIds: new Set() },
  explorationQuery: { kind: "none" as const },
  treeLayoutRootId: null,
  viewResetNonce: 0,
  centerOnNodeRequest: null,
  detailPanelOpen: true,
  setDetailPanelOpen: vi.fn(),
  handleSelectNode: vi.fn(),
  handleOpenNodeDetail: vi.fn(),
  handleSelectRelatedNodeId: vi.fn(),
  closeMobileNodeSheet: vi.fn(),
  nodeContextMenuItems: [],
  canvasMenuItems: [
    { id: "focus", label: "Focus", onSelect: vi.fn() },
    { id: "neighbors", label: "이웃 노드 보기", onSelect: vi.fn() },
  ],
  buildMobileNodeMenuItems: () => [],
  actionSheetNode: null,
  setSelectedEdgeId: vi.fn(),
  detailTab: "details" as const,
  setDetailTab: vi.fn(),
  openTraceForNode: vi.fn(),
};

describe("ProjectKnowledgeGraphExplorerPane", () => {
  it("renders explorer shell and context menu labels", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphExplorerPane, {
        projectId: "p1",
        clientReady: true,
        searchParams: null,
        nodes: [],
        edges: [],
        loading: false,
        error: null,
        reloadGraph: async () => {},
        variant: "page",
        explorerState: explorerStub as never,
        runtimeStatusSummary: {
          status: "READY",
          statusLabel: "구조화 완료",
          nodeCount: 2,
          edgeCount: 1,
        },
        runtimeStatusLoading: false,
        runtimeStatusError: null,
        uxMode: "diagnostic",
      }),
    );
    expect(html).toContain("project-knowledge-graph-explorer-pane");
    expect(html).toContain("선택된 노드 없음");
    expect(html).toContain("그래프 질문 검색");
    expect(html).toContain("그래프 변화 보기");
    expect(html).toContain("knowledge-replay-open");
    expect(html).toContain("프로젝트 구조가 바뀐 과정을 확인합니다.");
    expect(html).toContain("knowledge-runtime-status-card");
  });

  it("keeps user mode summary on mobile layout", () => {
    const mobileStub = { ...explorerStub, graphMobileUx: true };
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphExplorerPane, {
        projectId: "p1",
        clientReady: true,
        searchParams: null,
        nodes: [],
        edges: [],
        loading: false,
        error: null,
        reloadGraph: async () => {},
        variant: "page",
        explorerState: mobileStub as never,
        uxMode: "user",
        runtimeStatusSummary: {
          status: "READY",
          statusLabel: "구조화 완료",
          nodeCount: 2,
          edgeCount: 1,
        },
      }),
    );
    expect(html).toContain("현재 프로젝트 구조");
    expect(html).not.toContain("Knowledge Activity");
    expect(html).not.toContain("Persistence: DATABASE");
  });

  it("collapses filters in user mode until toggle", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphExplorerPane, {
        projectId: "p1",
        clientReady: true,
        searchParams: null,
        nodes: [],
        edges: [],
        loading: false,
        error: null,
        reloadGraph: async () => {},
        variant: "page",
        explorerState: explorerStub as never,
        uxMode: "user",
      }),
    );
    expect(html).toContain("knowledge-graph-filters-toggle");
    expect(html).not.toContain('aria-label="그래프 질문 검색"');
  });
});
