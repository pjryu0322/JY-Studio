"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { StructureCandidateList } from "@/components/project-structure/StructureCandidateList";
import { StructureConflictPanel } from "@/components/project-structure/StructureConflictPanel";
import { StructureCandidateDetailPanel } from "@/components/project-structure/StructureCandidateDetailPanel";
import {
  fetchStructureCandidates,
  fetchStructureConflicts,
} from "@/lib/project-structure/structureReviewApi";
import type { StructureCandidateRow, StructureConflictRow } from "@/lib/project-structure/structureReviewUiTypes";
import {
  filterStructureCandidates,
  uniqueNodeTypes,
} from "@/lib/project-structure/structureReviewViewModel";
import { requirementsWorkspaceMainRowStyle } from "@/components/requirements/requirementsWorkspaceLayoutStyles";

const LIFECYCLE_OPTIONS = ["", "CANDIDATE", "APPROVED", "MODIFIED", "DEPRECATED", "ARCHIVED"] as const;

export function StructureCandidateReviewWorkspace({ projectId }: { readonly projectId: string }) {
  const { effectiveLayout } = useWorkspaceMode();
  const isMobile = effectiveLayout === "MOBILE";

  const [candidates, setCandidates] = useState<StructureCandidateRow[]>([]);
  const [conflicts, setConflicts] = useState<StructureConflictRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [nodeTypeFilter, setNodeTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConflicts, setShowConflicts] = useState(true);

  const reload = useCallback(
    async (opts?: { sync?: boolean }) => {
      const pid = projectId.trim();
      if (!pid) return;
      setError(null);
      if (opts?.sync) setSyncing(true);
      else setLoading(true);
      try {
        const [cand, conf] = await Promise.all([
          fetchStructureCandidates(pid, { sync: opts?.sync, lifecycle: lifecycleFilter || undefined }),
          fetchStructureConflicts(pid),
        ]);
        setCandidates(cand.candidates);
        setConflicts(conf.conflicts);
        setSelectedId((prev) => prev ?? cand.candidates[0]?.id ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "불러오기 실패");
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    [projectId, lifecycleFilter],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(
    () => filterStructureCandidates(candidates, { lifecycle: lifecycleFilter, nodeType: nodeTypeFilter, search }),
    [candidates, lifecycleFilter, nodeTypeFilter, search],
  );

  const nodeTypes = useMemo(() => uniqueNodeTypes(candidates), [candidates]);
  const selected = filtered.find((c) => c.id === selectedId) ?? candidates.find((c) => c.id === selectedId) ?? null;

  const shell: CSSProperties = {
    ...requirementsWorkspaceMainRowStyle,
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    flex: 1,
    minHeight: 0,
  };

  const leftPane: CSSProperties = {
    flex: isMobile ? "0 0 auto" : "0 0 320px",
    maxWidth: isMobile ? "100%" : 360,
    minWidth: 0,
    borderRight: isMobile ? "none" : `1px solid ${t.border}`,
    borderBottom: isMobile ? `1px solid ${t.border}` : "none",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    maxHeight: isMobile ? "42vh" : undefined,
  };

  const rightPane: CSSProperties = {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  return (
    <div style={shell}>
      <aside style={leftPane} aria-label="구조 후보 목록">
        <div style={{ padding: 12, borderBottom: `1px solid ${t.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              disabled={syncing}
              onClick={() => void reload({ sync: true })}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: t.bgPage,
                cursor: syncing ? "wait" : "pointer",
              }}
            >
              {syncing ? "동기화 중…" : "Event Store 동기화"}
            </button>
            <button
              type="button"
              onClick={() => setShowConflicts((v) => !v)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: showConflicts ? "#eff6ff" : t.bgPage,
              }}
            >
              충돌 {conflicts.length}
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색"
            style={{ fontSize: 13, padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}` }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              value={lifecycleFilter}
              onChange={(e) => setLifecycleFilter(e.target.value)}
              style={{ fontSize: 12, padding: 6, borderRadius: 8, border: `1px solid ${t.border}`, flex: "1 1 120px" }}
            >
              {LIFECYCLE_OPTIONS.map((v) => (
                <option key={v || "all"} value={v}>
                  {v ? v : "Lifecycle 전체"}
                </option>
              ))}
            </select>
            <select
              value={nodeTypeFilter}
              onChange={(e) => setNodeTypeFilter(e.target.value)}
              style={{ fontSize: 12, padding: 6, borderRadius: 8, border: `1px solid ${t.border}`, flex: "1 1 120px" }}
            >
              <option value="">Node Type 전체</option>
              {nodeTypes.map((nt) => (
                <option key={nt} value={nt}>
                  {nt}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {loading ? <p style={{ fontSize: 13, color: t.textMuted }}>불러오는 중…</p> : null}
          {error ? <p style={{ fontSize: 13, color: t.danger }}>{error}</p> : null}
          <StructureCandidateList
            candidates={filtered}
            conflicts={conflicts}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {showConflicts ? (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 8px" }}>충돌</h2>
              <StructureConflictPanel conflicts={conflicts} onSelectCandidate={setSelectedId} />
            </div>
          ) : null}
        </div>
      </aside>
      <main style={rightPane}>
        <StructureCandidateDetailPanel
          projectId={projectId}
          candidate={selected}
          conflicts={conflicts}
          candidates={candidates}
          onRefresh={() => void reload()}
        />
      </main>
    </div>
  );
}
