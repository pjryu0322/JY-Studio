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
import { ProjectKnowledgeReplayDiffSummary } from "@/components/project-graph/ProjectKnowledgeReplayDiffSummary";
import {
  formatKnowledgeRevisionChangeHintInline,
  knowledgeGraphSnapshotToCanvasGraph,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionUi";
import {
  KNOWLEDGE_REPLAY_AUTOPLAY_MS,
  isReplayControlsBlocked,
  isReplayLatestDisabled,
  isReplayNextDisabled,
  isReplayPreviousDisabled,
  replayAutoplayTick,
  replayLatestIndex,
  replayNextIndex,
  replayPreviousIndex,
  resolveReplayAutoplayStartIndex,
} from "@/lib/project-knowledge/projectKnowledgeReplayNavigation";
import type {
  KnowledgeGraphRevisionListItem,
  KnowledgeGraphRevisionSnapshot,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";
import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";

const navBtnStyle: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: "8px 12px",
  borderRadius: 10,
  border: `1px solid ${t.border}`,
  background: t.bgPage,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const summaryClamp: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  WebkitLineClamp: 2,
};

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
  const [isPlaying, setIsPlaying] = useState(false);

  const pauseAutoplay = useCallback(() => setIsPlaying(false), []);

  const selectIndex = useCallback(
    (index: number) => {
      pauseAutoplay();
      setSelectedIndex(index);
    },
    [pauseAutoplay],
  );

  const handleClose = useCallback(() => {
    pauseAutoplay();
    p.onClose();
  }, [p.onClose, pauseAutoplay]);

  const reloadList = useCallback(async () => {
    if (!p.open) return;
    setListLoading(true);
    setListError(null);
    try {
      const items = await fetchKnowledgeGraphRevisions(p.projectId);
      setRevisions(items);
      setSelectedIndex(items.length > 0 ? items.length - 1 : 0);
      setSnapshotCache({});
      setIsPlaying(false);
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
    if (!p.open) {
      pauseAutoplay();
    }
  }, [p.open, pauseAutoplay]);

  const loadRevisionSnapshot = useCallback(
    (revisionId: string) => {
      if (!revisionId) return;
      void fetchKnowledgeGraphRevision(p.projectId, revisionId)
        .then((detail) => {
          setSnapshotCache((prev) => {
            if (prev[revisionId]) return prev;
            return { ...prev, [revisionId]: detail.graphSnapshot };
          });
        })
        .catch(() => {
          /* optional prefetch */
        });
    },
    [p.projectId],
  );

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
        setDetailError(error instanceof Error ? error.message : "구조를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [p.open, p.projectId, revisions, selectedIndex, snapshotCache]);

  useEffect(() => {
    if (!p.open || selectedIndex <= 0) return;
    const prevRev = revisions[selectedIndex - 1];
    if (prevRev) loadRevisionSnapshot(prevRev.id);
  }, [p.open, revisions, selectedIndex, loadRevisionSnapshot]);

  useEffect(() => {
    if (!isPlaying || !p.open || revisions.length === 0) return;
    const timer = window.setInterval(() => {
      setSelectedIndex((idx) => {
        const tick = replayAutoplayTick(idx, revisions.length);
        if (tick.stop) {
          setIsPlaying(false);
        }
        return tick.nextIndex;
      });
    }, KNOWLEDGE_REPLAY_AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying, p.open, revisions.length]);

  const selectedRevision = revisions[selectedIndex] ?? null;
  const previousRevision = selectedIndex > 0 ? revisions[selectedIndex - 1] ?? null : null;
  const currentSnapshot = selectedRevision ? snapshotCache[selectedRevision.id] ?? null : null;
  const previousSnapshot = previousRevision ? snapshotCache[previousRevision.id] ?? null : null;

  const diffLines = useMemo(() => {
    if (!currentSnapshot) return [];
    return diffKnowledgeGraphRevisions(previousSnapshot, currentSnapshot).lines;
  }, [currentSnapshot, previousSnapshot]);

  const changeHintsByIndex = useMemo((): readonly (string | null)[] => {
    return revisions.map((rev, index) => {
      const snap = snapshotCache[rev.id];
      if (!snap) return null;
      const prevRev = index > 0 ? revisions[index - 1] : null;
      const prevSnap = prevRev ? snapshotCache[prevRev.id] : null;
      if (index > 0 && prevRev && !prevSnap) return null;
      return formatKnowledgeRevisionChangeHintInline(diffKnowledgeGraphRevisions(prevSnap, snap).lines);
    });
  }, [revisions, snapshotCache]);

  const canvasGraph = useMemo((): { nodes: ProjectGraphNodeDto[]; edges: ProjectGraphEdgeDto[] } => {
    if (!currentSnapshot) return { nodes: [], edges: [] };
    return knowledgeGraphSnapshotToCanvasGraph(currentSnapshot);
  }, [currentSnapshot]);

  const maxIndex = Math.max(0, revisions.length - 1);
  const sliderDisabled = revisions.length <= 1;
  const revisionCount = revisions.length;
  const controlsBlocked = isReplayControlsBlocked({ listLoading, detailLoading, revisionCount });
  const showEmptyState = !listLoading && !listError && revisionCount === 0;

  const handlePlayToggle = useCallback(() => {
    if (isPlaying) {
      pauseAutoplay();
      return;
    }
    if (revisionCount <= 1 || controlsBlocked) return;
    const startIndex = resolveReplayAutoplayStartIndex(selectedIndex, revisionCount);
    if (startIndex !== selectedIndex) {
      setSelectedIndex(startIndex);
    }
    setIsPlaying(true);
  }, [isPlaying, pauseAutoplay, revisionCount, controlsBlocked, selectedIndex]);

  const bodyRow: CSSProperties = {
    display: "flex",
    flexDirection: graphMobileUx ? "column" : "row",
    flex: 1,
    minHeight: 0,
    gap: graphMobileUx ? 8 : 12,
  };

  const diffForCard = diffLines.filter((line) => line !== "변화 없음");

  const navDisabled = (base: boolean) => base || controlsBlocked;
  const sliderBlocked = sliderDisabled || controlsBlocked;

  return (
    <ProjectKnowledgeGraphModalShell open={p.open} title="프로젝트 변화 이력" onClose={handleClose}>
      <div data-testid="knowledge-replay-modal" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.45 }} data-testid="knowledge-replay-intro">
          대화와 AI 추천안이 프로젝트 구조를 어떻게 바꿨는지 확인합니다.
        </p>

        {listError ? <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{listError}</p> : null}
        {listLoading ? <p style={{ margin: 0, color: t.textMuted, fontSize: 13 }}>변화 이력 불러오는 중…</p> : null}

        {showEmptyState ? (
          <div
            data-testid="knowledge-replay-empty-state"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "24px 16px",
              borderRadius: 12,
              border: `1px dashed ${t.border}`,
              background: "#f8fafc",
              minHeight: graphMobileUx ? 200 : 280,
              gap: 12,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: t.textPrimary }}>아직 변화 이력이 없습니다.</div>
            <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.55, maxWidth: 360 }}>
              기획 대화를 진행하거나 AI 추천안을 적용하면
              <br />
              프로젝트 구조가 바뀐 과정이 이곳에 표시됩니다.
            </p>
            <button
              type="button"
              data-testid="knowledge-replay-empty-confirm"
              aria-label="확인하고 닫기"
              onClick={handleClose}
              style={{ ...navBtnStyle, minWidth: 120 }}
            >
              확인
            </button>
          </div>
        ) : null}

        {!showEmptyState && selectedRevision ? (
          <div
            data-testid="knowledge-replay-summary-card"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${t.border}`,
              background: "#f8fafc",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>현재 변화</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: t.textPrimary }}>{selectedRevision.title}</div>
            {selectedRevision.summary ? (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: t.textSecondary, lineHeight: 1.45, ...summaryClamp }}>
                {selectedRevision.summary}
              </p>
            ) : null}
            <div style={{ marginTop: 8, fontSize: 12, color: t.textMuted }}>
              항목 {selectedRevision.nodeCount}개 · 연결 {selectedRevision.edgeCount}개
            </div>
            {diffForCard.length > 0 ? (
              <div
                data-testid="knowledge-replay-summary-diff"
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: t.textSecondary,
                }}
              >
                <ProjectKnowledgeReplayDiffSummary lines={diffForCard} />
              </div>
            ) : null}
          </div>
        ) : null}

        {!showEmptyState ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                data-testid="knowledge-replay-prev"
                aria-label="이전 변화 보기"
                disabled={navDisabled(isReplayPreviousDisabled(selectedIndex))}
                onClick={() => selectIndex(replayPreviousIndex(selectedIndex))}
                style={navBtnStyle}
              >
                ◀ 이전 변화
              </button>
              <button
                type="button"
                data-testid="knowledge-replay-next"
                aria-label="다음 변화 보기"
                disabled={navDisabled(isReplayNextDisabled(selectedIndex, revisionCount))}
                onClick={() => selectIndex(replayNextIndex(selectedIndex, revisionCount))}
                style={navBtnStyle}
              >
                다음 변화 ▶
              </button>
              <button
                type="button"
                data-testid="knowledge-replay-latest"
                aria-label="최신 변화 보기"
                disabled={navDisabled(isReplayLatestDisabled(selectedIndex, revisionCount))}
                onClick={() => selectIndex(replayLatestIndex(revisionCount))}
                style={navBtnStyle}
              >
                최신 보기
              </button>
              <button
                type="button"
                data-testid={isPlaying ? "knowledge-replay-pause" : "knowledge-replay-play"}
                aria-label={isPlaying ? "변화 이력 재생 일시정지" : "변화 이력 자동재생"}
                disabled={revisionCount <= 1 || controlsBlocked}
                onClick={handlePlayToggle}
                style={{ ...navBtnStyle, marginLeft: graphMobileUx ? 0 : "auto" }}
              >
                {isPlaying ? "⏸ 일시정지" : "▶ 재생"}
              </button>
            </div>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: t.textSecondary,
              }}
            >
              변화 단계 선택
              <input
                type="range"
                data-testid="knowledge-replay-slider"
                min={0}
                max={maxIndex}
                step={1}
                disabled={sliderBlocked}
                value={Math.min(selectedIndex, maxIndex)}
                onChange={(e) => selectIndex(Number(e.target.value))}
                aria-valuetext={revisions[selectedIndex]?.title ?? ""}
                aria-label="변화 단계 선택"
              />
            </label>

            <div style={bodyRow}>
              {!graphMobileUx ? (
                <ProjectKnowledgeReplayTimeline
                  revisions={revisions}
                  selectedIndex={selectedIndex}
                  onSelectIndex={selectIndex}
                  diffLines={diffLines}
                  changeHintsByIndex={changeHintsByIndex}
                />
              ) : null}
              <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {graphMobileUx ? (
                  <button
                    type="button"
                    data-testid="knowledge-replay-timeline-sheet-toggle"
                    aria-label={timelineSheetOpen ? "변화 이력 닫기" : "변화 이력 보기"}
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
                    {timelineSheetOpen ? "변화 이력 닫기" : "변화 이력 보기"}
                  </button>
                ) : null}
                <ProjectKnowledgeReplayViewer
                  nodes={canvasGraph.nodes}
                  edges={canvasGraph.edges}
                  frameKey={selectedRevision?.id ?? String(selectedIndex)}
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
                    selectIndex(idx);
                    setTimelineSheetOpen(false);
                  }}
                  diffLines={diffLines}
                  changeHintsByIndex={changeHintsByIndex}
                  compact
                  clampSummary
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </ProjectKnowledgeGraphModalShell>
  );
}
