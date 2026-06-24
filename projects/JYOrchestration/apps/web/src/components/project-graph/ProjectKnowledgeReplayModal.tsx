"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ProjectKnowledgeGraphModalShell } from "@/components/project-graph/ProjectKnowledgeGraphModalShell";
import { ProjectKnowledgeReplayTimeline } from "@/components/project-graph/ProjectKnowledgeReplayTimeline";
import { ProjectKnowledgeReplayViewer } from "@/components/project-graph/ProjectKnowledgeReplayViewer";
import { useGraphMobileUx } from "@/components/project-graph/useGraphMobileUx";
import { uiTokens as t } from "@/components/ui/tokens";
import {
  fetchKnowledgeGraphRevision,
  fetchKnowledgeGraphRevisions,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionClient";
import { diffKnowledgeGraphRevisions } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionDiff";
import { knowledgeGraphSnapshotToCanvasGraph } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionUi";
import type {
  KnowledgeGraphRevisionListItem,
  KnowledgeGraphRevisionSnapshot,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";
import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";

export function ProjectKnowledgeReplayModal(p: {
  readonly open: boolean;
  readonly projectId: string;
  readonly onClose: () => void;
}) {
  const graphMobileUx = useGraphMobileUx();
  const [revisions, setRevisions] = useState<KnowledgeGraphRevisionListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapshotCache, setSnapshotCache] = useState<Record<string, KnowledgeGraphRevisionSnapshot>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [timelineSheetOpen, setTimelineSheetOpen] = useState(true);

  const reloadList = useCallback(async () => {
    if (!p.open) return;
    setListLoading(true);
    setListError(null);
    try {
      const items = await fetchKnowledgeGraphRevisions(p.projectId);
      setRevisions(items);
      setSelectedIndex(items.length > 0 ? items.length - 1 : 0);
      setSnapshotCache({});
    } catch (error) {
      setListError(error instanceof Error ? error.message : "목록을 불러오지 못했습니다.");
      setRevisions([]);
    } finally {
      setListLoading(false);
    }
  }, [p.open, p.projectId]);

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  useEffect(() => {
    if (!p.open || revisions.length === 0) return;
    const rev = revisions[selectedIndex];
    if (!rev) return;
    if (snapshotCache[rev.id]) return;

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void fetchKnowledgeGraphRevision(p.projectId, rev.id)
      .then((detail) => {
        if (cancelled) return;
        setSnapshotCache((prev) => ({ ...prev, [rev.id]: detail.graphSnapshot }));
      })
      .catch((error) => {
        if (cancelled) return;
        setDetailError(error instanceof Error ? error.message : "그래프를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [p.open, p.projectId, revisions, selectedIndex, snapshotCache]);

  const selectedRevision = revisions[selectedIndex] ?? null;
  const previousRevision = selectedIndex > 0 ? revisions[selectedIndex - 1] ?? null : null;
  const currentSnapshot = selectedRevision ? snapshotCache[selectedRevision.id] ?? null : null;
  const previousSnapshot = previousRevision ? snapshotCache[previousRevision.id] ?? null : null;

  const diffLines = useMemo(() => {
    if (!currentSnapshot) return [];
    return diffKnowledgeGraphRevisions(previousSnapshot, currentSnapshot).lines;
  }, [currentSnapshot, previousSnapshot]);

  const canvasGraph = useMemo((): { nodes: ProjectGraphNodeDto[]; edges: ProjectGraphEdgeDto[] } => {
    if (!currentSnapshot) return { nodes: [], edges: [] };
    return knowledgeGraphSnapshotToCanvasGraph(currentSnapshot);
  }, [currentSnapshot]);

  const maxIndex = Math.max(0, revisions.length - 1);
  const sliderDisabled = revisions.length <= 1;

  const bodyRow: CSSProperties = {
    display: "flex",
    flexDirection: graphMobileUx ? "column" : "row",
    flex: 1,
    minHeight: 0,
    gap: graphMobileUx ? 8 : 12,
  };

  return (
    <ProjectKnowledgeGraphModalShell open={p.open} title="그래프 변화 보기" onClose={p.onClose}>
      <div data-testid="knowledge-replay-modal" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 10 }}>
        {listError ? <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{listError}</p> : null}
        {listLoading ? <p style={{ margin: 0, color: t.textMuted, fontSize: 13 }}>타임라인 불러오는 중…</p> : null}

        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: t.textSecondary }}>
          시점 이동
          <input
            type="range"
            data-testid="knowledge-replay-slider"
            min={0}
            max={maxIndex}
            step={1}
            disabled={sliderDisabled}
            value={Math.min(selectedIndex, maxIndex)}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            aria-valuetext={revisions[selectedIndex]?.title ?? ""}
          />
        </label>

        <div style={bodyRow}>
          {!graphMobileUx ? (
            <ProjectKnowledgeReplayTimeline
              revisions={revisions}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
              diffLines={diffLines}
            />
          ) : null}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {graphMobileUx ? (
              <button
                type="button"
                data-testid="knowledge-replay-timeline-sheet-toggle"
                onClick={() => setTimelineSheetOpen((v) => !v)}
                style={{
                  minHeight: 44,
                  borderRadius: 10,
                  border: `1px solid ${t.border}`,
                  background: t.bgPage,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {timelineSheetOpen ? "타임라인 접기" : "타임라인 보기"}
              </button>
            ) : null}
            <ProjectKnowledgeReplayViewer
              nodes={canvasGraph.nodes}
              edges={canvasGraph.edges}
              loading={detailLoading}
              error={detailError}
              graphMobileUx={graphMobileUx}
            />
          </div>
        </div>

        {graphMobileUx && timelineSheetOpen ? (
          <div
            data-testid="knowledge-replay-timeline-sheet"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 60,
              maxHeight: "45dvh",
              background: "#fff",
              borderTop: `1px solid ${t.border}`,
              boxShadow: "0 -12px 32px rgba(15,23,42,0.12)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <ProjectKnowledgeReplayTimeline
              revisions={revisions}
              selectedIndex={selectedIndex}
              onSelectIndex={(idx) => {
                setSelectedIndex(idx);
                setTimelineSheetOpen(false);
              }}
              diffLines={diffLines}
              compact
            />
          </div>
        ) : null}
      </div>
    </ProjectKnowledgeGraphModalShell>
  );
}
