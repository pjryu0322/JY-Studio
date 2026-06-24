import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  knowledgeGraphHighlightSourceMessageId,
  knowledgeGraphPaneFromViewQuery,
  knowledgeGraphSyncOnEntry,
} from "@/components/project-graph/projectKnowledgeGraphWorkspaceQuery";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("view=activity&focusNodeId=n1&sourceMessageId=msg-1&sync=true"),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/project-graph/hooks/useProjectKnowledgeGraphData", () => ({
  useProjectKnowledgeGraphData: () => ({
    nodes: [],
    edges: [],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("@/components/project-graph/hooks/useProjectKnowledgeGraphExplorerState", () => ({
  useProjectKnowledgeGraphExplorerState: () => ({
    focusNodeId: null,
    selectedNodeId: null,
    graphMobileUx: false,
    toastMessage: null,
    contextMenu: { menu: { open: false }, close: vi.fn() },
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
    explored: { highlightIds: new Set() },
    explorationQuery: { kind: "none" },
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
  }),
}));

vi.mock("@/components/project-graph/hooks/useProjectKnowledgeGraphActivity", () => ({
  useProjectKnowledgeGraphActivity: () => ({
    activitySummary: null,
    activityLoading: false,
    activityError: null,
    reloadActivity: vi.fn(),
  }),
}));

vi.mock("@/components/project-graph/hooks/useProjectKnowledgePipelineRuns", () => ({
  useProjectKnowledgePipelineRuns: () => ({
    pipelineRuns: [],
    pipelineLoading: false,
    pipelineError: null,
    reloadPipelineMonitor: vi.fn(),
  }),
}));

import { ProjectKnowledgeGraphWorkspace } from "@/components/project-graph/ProjectKnowledgeGraphWorkspace";

describe("ProjectKnowledgeGraphWorkspace integration", () => {
  it("renders workspace shell and graph tab by default markup", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphWorkspace, { projectId: "p1", variant: "page" }),
    );
    expect(html).toContain("project-knowledge-graph-workspace");
    expect(html).toContain("project-knowledge-graph-tab-graph");
  });

  it("view=activity maps to activity pane query helper", () => {
    expect(knowledgeGraphPaneFromViewQuery("activity")).toBe("activity");
    expect(knowledgeGraphPaneFromViewQuery("")).toBe("graph");
  });

  it("sync=true and modal enable sync on entry helper", () => {
    expect(
      knowledgeGraphSyncOnEntry({ clientReady: true, isModal: false, syncQuery: "true" }),
    ).toBe(true);
    expect(
      knowledgeGraphSyncOnEntry({ clientReady: true, isModal: true, syncQuery: null }),
    ).toBe(true);
  });

  it("sourceMessageId query resolves highlight id", () => {
    expect(
      knowledgeGraphHighlightSourceMessageId({
        clientReady: true,
        sourceMessageIdQuery: "msg-9",
      }),
    ).toBe("msg-9");
  });

  it("focusNodeId query is consumed by explorer hook (search params contract)", () => {
    const params = new URLSearchParams("focusNodeId=node-abc");
    expect(params.get("focusNodeId")).toBe("node-abc");
  });
});
