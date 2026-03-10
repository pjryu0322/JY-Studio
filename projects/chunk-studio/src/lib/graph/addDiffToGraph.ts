import type { TemplateDiffResponse } from "@/types/template";
import type { DocumentGraph } from "./graphTypes";

export function addDiffToGraph(
  graph: DocumentGraph,
  diff: TemplateDiffResponse,
  docAId: string,
  docBId: string
): DocumentGraph {
  const next: DocumentGraph = {
    nodes: [...graph.nodes],
    edges: [...graph.edges],
  };
  const docNodeId = `doc:${docAId}`;

  diff.fieldsChanged.forEach((item, idx) => {
    const nodeId = `diff:field:${idx + 1}`;
    next.nodes.push({
      id: nodeId,
      type: "diffEvent",
      label: `FIELD ${item.label}`,
      props: {
        target: item.key,
        oldValue: item.oldValue,
        newValue: item.newValue,
        compareTo: docBId,
      },
    });
    next.edges.push({
      id: `edge:${docNodeId}->${nodeId}`,
      from: docNodeId,
      to: nodeId,
      type: "HAS_DIFF",
    });
  });

  diff.sectionsChanged
    .filter((item) => item.changeType !== "unchanged")
    .forEach((item, idx) => {
      const nodeId = `diff:section:${idx + 1}`;
      next.nodes.push({
        id: nodeId,
        type: "diffEvent",
        label: `SECTION ${item.title}`,
        props: {
          sectionId: item.sectionId,
          similarity: item.similarity,
          changeType: item.changeType,
          compareTo: docBId,
        },
      });
      next.edges.push({
        id: `edge:${docNodeId}->${nodeId}`,
        from: docNodeId,
        to: nodeId,
        type: "HAS_DIFF",
      });
    });

  diff.tablesChanged.forEach((item, idx) => {
    const nodeId = `diff:table:${idx + 1}`;
    next.nodes.push({
      id: nodeId,
      type: "diffEvent",
      label: `TABLE ${item.tableId}`,
      props: {
        addedRows: item.addedRows.length,
        removedRows: item.removedRows.length,
        modifiedRows: item.modifiedRows.length,
        compareTo: docBId,
      },
    });
    next.edges.push({
      id: `edge:${docNodeId}->${nodeId}`,
      from: docNodeId,
      to: nodeId,
      type: "HAS_DIFF",
    });
  });

  return next;
}
