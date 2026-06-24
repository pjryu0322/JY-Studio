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
      }),
    );
    expect(html).toContain("project-knowledge-graph-explorer-pane");
    expect(html).toContain("선택된 노드 없음");
    expect(html).toContain("그래프 질문 검색");
  });
});
