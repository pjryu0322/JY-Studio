import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectKnowledgeGraphExplorerPane } from "@/components/project-graph/ProjectKnowledgeGraphExplorerPane";
import { ProjectKnowledgeGraphLogDrawer } from "@/components/project-graph/ProjectKnowledgeGraphLogDrawer";

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
  filteredNodes: [{ id: "n1", title: "A", nodeType: "FEATURE", lifecycle: "APPROVED" }],
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
  canvasMenuItems: [{ id: "focus", label: "Focus", onSelect: vi.fn() }],
  buildMobileNodeMenuItems: () => [],
  actionSheetNode: null,
  setSelectedEdgeId: vi.fn(),
  detailTab: "details" as const,
  setDetailTab: vi.fn(),
  openTraceForNode: vi.fn(),
  clearGraphSelection: vi.fn(),
  clearGraphDetail: vi.fn(),
  clearSelectedEdge: vi.fn(),
};

describe("ProjectKnowledgeGraphExplorerPane UX", () => {
  it("uses compact summary and action bar without duplicate structure titles", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphExplorerPane, {
        projectId: "p1",
        clientReady: true,
        searchParams: null,
        nodes: [{ id: "n1", title: "A", nodeType: "FEATURE", lifecycle: "APPROVED" }],
        edges: [],
        loading: false,
        error: null,
        reloadGraph: async () => {},
        variant: "page",
        explorerState: explorerStub as never,
        uxMode: "user",
        runtimeStatusSummary: {
          status: "NEEDS_REVIEW",
          statusLabel: "검토 필요",
          nodeCount: 21,
          edgeCount: 24,
          latestChangedAt: "2026-06-27T02:36:00.000Z",
        },
        onOpenChangeLog: vi.fn(),
        onOpenKnowledgeLog: vi.fn(),
        onOpenDiagnosticLog: vi.fn(),
        onReloadRuntimeStatus: vi.fn(),
      }),
    );
    expect(html).toContain("knowledge-graph-summary-bar");
    expect(html).toContain("knowledge-graph-action-bar");
    expect(html).toContain("전체 1 nodes · 0 edges");
    expect(html).not.toContain("21 nodes");
    expect(html).not.toContain("현재 프로젝트 구조");
    expect(html).not.toContain("user-memory-control-enabled");
    expect(html).not.toContain("과거 지식: 참조");
    expect(html).not.toContain("상세 로그 보기");
    expect(html).not.toContain("knowledge-log-tab-changes");
  });

  it("places canvas region after agent tabs", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphExplorerPane, {
        projectId: "p1",
        clientReady: true,
        searchParams: null,
        nodes: [{ id: "n1", title: "A", nodeType: "FEATURE", lifecycle: "APPROVED" }],
        edges: [],
        loading: false,
        error: null,
        reloadGraph: async () => {},
        variant: "page",
        explorerState: explorerStub as never,
        uxMode: "user",
        runtimeStatusSummary: {
          status: "READY",
          statusLabel: "완료",
          nodeCount: 1,
          edgeCount: 0,
        },
      }),
    );
    const tabsIdx = html.indexOf("knowledge-graph-agent-view-tabs");
    const canvasIdx = html.indexOf("knowledge-graph-canvas-region");
    expect(tabsIdx).toBeGreaterThan(-1);
    expect(canvasIdx).toBeGreaterThan(tabsIdx);
  });

  it("exposes memory settings and log entry buttons on the default surface", () => {
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
        runtimeStatusSummary: {
          status: "READY",
          statusLabel: "완료",
          nodeCount: 0,
          edgeCount: 0,
        },
        onReloadRuntimeStatus: vi.fn(),
      }),
    );
    expect(html).toContain("knowledge-memory-settings-open");
    expect(html).toContain("knowledge-graph-log-open");
    expect(html).toContain("지식 반영 설정");
    expect(html).toContain("로그");
    expect(html).not.toContain("과거 지식:");
  });
});

describe("ProjectKnowledgeGraphLogDrawer", () => {
  it("renders tabs and close control when open", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphLogDrawer, {
        open: true,
        onClose: vi.fn(),
        onOpenChangeLog: vi.fn(),
        onOpenGraphReplay: vi.fn(),
      }),
    );
    expect(html).toContain("knowledge-graph-log-drawer");
    expect(html).toContain("knowledge-log-tab-changes");
    expect(html).toContain("knowledge-log-tab-knowledge");
    expect(html).toContain("knowledge-log-tab-diagnostics");
    expect(html).toContain("knowledge-graph-log-close");
    expect(html).toContain("knowledge-log-open-replay");
  });
});
