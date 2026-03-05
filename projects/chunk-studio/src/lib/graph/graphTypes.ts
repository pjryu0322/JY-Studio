export interface GraphNode {
  id: string;
  type: "doc" | "section" | "field" | "table" | "repeatItem" | "diffEvent";
  label: string;
  props?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type:
    | "HAS_SECTION"
    | "HAS_FIELD"
    | "HAS_TABLE"
    | "HAS_REPEAT_ITEM"
    | "HAS_DIFF";
  props?: Record<string, unknown>;
}

export interface DocumentGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
