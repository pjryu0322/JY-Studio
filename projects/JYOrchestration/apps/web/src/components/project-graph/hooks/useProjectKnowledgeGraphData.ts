"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchProjectGraph, type ProjectGraphEdgeDto, type ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import { subscribeProjectKnowledgeGraphResetBroadcast } from "@/lib/project-graph/projectKnowledgeGraphResetBroadcast";

export function useProjectKnowledgeGraphData(input: {
  readonly projectId: string;
  readonly clientReady: boolean;
  readonly syncOnEntry: boolean;
}) {
  const [nodes, setNodes] = useState<ProjectGraphNodeDto[]>([]);
  const [edges, setEdges] = useState<ProjectGraphEdgeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staleAfterReset, setStaleAfterReset] = useState(false);

  const reload = useCallback(async () => {
    const pid = input.projectId.trim();
    if (!pid) return;
    setError(null);
    setLoading(true);
    try {
      const graph = await fetchProjectGraph(pid, { limit: 300 });
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setStaleAfterReset(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [input.projectId]);

  useEffect(() => {
    if (!input.clientReady) return;
    void (async () => {
      const pid = input.projectId.trim();
      if (!pid) return;
      if (input.syncOnEntry) {
        await fetch(`/api/projects/${encodeURIComponent(pid)}/graph?sync=true&limit=1`, {
          credentials: "include",
          cache: "no-store",
        });
      }
      await reload();
    })();
  }, [input.clientReady, input.projectId, input.syncOnEntry, reload]);

  useEffect(() => {
    if (!input.clientReady) return;
    const pid = input.projectId.trim();
    if (!pid) return;
    return subscribeProjectKnowledgeGraphResetBroadcast((message) => {
      if (message.projectId !== pid) return;
      setStaleAfterReset(true);
      void reload();
    });
  }, [input.clientReady, input.projectId, reload]);

  return { nodes, edges, loading, error, reload, staleAfterReset };
}
