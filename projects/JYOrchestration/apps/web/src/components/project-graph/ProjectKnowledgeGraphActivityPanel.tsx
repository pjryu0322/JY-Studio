"use client";

import { useMemo, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type {
  ProjectGraphActivityFeedRow,
  ProjectGraphActivitySummary,
} from "@/lib/project-graph/projectGraphActivityClient";

export function ProjectKnowledgeGraphActivityPanel(p: {
  readonly summary: ProjectGraphActivitySummary | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly highlightSourceMessageId: string | null;
  readonly onRefresh: () => void;
}) {
  const s = p.summary;
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);

  const selectedRow = useMemo(
    () => s?.feed.find((row) => row.id === selectedFeedId) ?? null,
    [s?.feed, selectedFeedId],
  );

  return (
    <section
      data-testid="project-knowledge-graph-activity-panel"
      style={{
        marginBottom: 12,
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: t.textPrimary }}>Knowledge Graph 생성 현황</h2>
        <button
          type="button"
          onClick={p.onRefresh}
          disabled={p.loading}
          style={{
            marginLeft: "auto",
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.bgPage,
            cursor: p.loading ? "not-allowed" : "pointer",
          }}
        >
          {p.loading ? "동기화 중…" : "새로고침"}
        </button>
      </div>

      <p style={{ margin: "0 0 10px", fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
        Activity 항목을 선택하면 세부 정보를 확인할 수 있습니다.
      </p>

      {p.error ? <p style={{ margin: "0 0 8px", color: "#b91c1c", fontSize: 12 }}>{p.error}</p> : null}

      {s ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: 8,
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            <Stat label="Event" value={s.eventCount} />
            <Stat label="Candidate" value={s.candidateCount} />
            <Stat label="Approved Node" value={s.approvedNodeCount} />
            <Stat label="Graph Edge" value={s.edgeCount} />
            <Stat label="Conflict" value={s.conflictCount} />
            <Stat label="마지막 동기화" value={s.lastSyncedAt ? formatSynced(s.lastSyncedAt) : "—"} text />
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: t.textSecondary }}>Activity</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {s.feed.length === 0 ? (
              <li style={{ fontSize: 12, color: t.textMuted }}>표시할 활동이 없습니다.</li>
            ) : (
              s.feed.map((row) => (
                <ActivityFeedRowButton
                  key={row.id}
                  row={row}
                  selected={selectedFeedId === row.id}
                  highlight={
                    Boolean(
                      p.highlightSourceMessageId &&
                        row.sourceMessageId &&
                        row.sourceMessageId === p.highlightSourceMessageId,
                    )
                  }
                  onSelect={() => setSelectedFeedId((cur) => (cur === row.id ? null : row.id))}
                />
              ))
            )}
          </ul>

          {selectedRow ? <ActivityFeedDetail row={selectedRow} /> : null}
        </>
      ) : p.loading ? (
        <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>생성 현황 불러오는 중…</p>
      ) : null}
    </section>
  );
}

function ActivityFeedRowButton(p: {
  readonly row: ProjectGraphActivityFeedRow;
  readonly selected: boolean;
  readonly highlight: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={p.onSelect}
        aria-expanded={p.selected}
        style={{
          width: "100%",
          textAlign: "left",
          fontSize: 12,
          padding: "6px 8px",
          borderRadius: 6,
          border: p.selected ? `1px solid ${t.primary}` : "1px solid transparent",
          background: p.highlight ? "#ecfdf5" : p.selected ? "#eff6ff" : "transparent",
          color: t.textPrimary,
          cursor: "pointer",
        }}
      >
        <span style={{ color: t.textMuted, marginRight: 8 }}>{p.row.at}</span>
        {p.row.line}
      </button>
    </li>
  );
}

function ActivityFeedDetail({ row }: { readonly row: ProjectGraphActivityFeedRow }) {
  const d = row.detail;
  return (
    <div
      data-testid="project-knowledge-graph-activity-detail"
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${t.border}`,
        background: t.bgPage,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 8, color: t.textPrimary }}>세부 정보</div>
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "96px 1fr", gap: "4px 10px" }}>
        <DetailTerm label="유형" value={row.kind === "event" ? "Event" : "Candidate"} />
        {d.eventType ? <DetailTerm label="Event type" value={d.eventType} /> : null}
        {d.stage ? <DetailTerm label="Stage" value={d.stage} /> : null}
        {d.title ? <DetailTerm label="제목" value={d.title} /> : null}
        {d.lifecycleStatus ? <DetailTerm label="상태" value={d.lifecycleStatus} /> : null}
        {row.sourceMessageId ? <DetailTerm label="sourceMessageId" value={row.sourceMessageId} /> : null}
        {d.entityId ? <DetailTerm label="ID" value={d.entityId} /> : null}
      </dl>
      {d.summary ? (
        <p style={{ margin: "8px 0 0", color: t.textSecondary, whiteSpace: "pre-wrap" }}>{d.summary}</p>
      ) : null}
      {d.payloadPreview ? (
        <pre
          style={{
            margin: "8px 0 0",
            padding: 8,
            borderRadius: 8,
            background: "#f1f5f9",
            fontSize: 11,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {d.payloadPreview}
        </pre>
      ) : null}
    </div>
  );
}

function DetailTerm(p: { readonly label: string; readonly value: string }) {
  return (
    <>
      <dt style={{ margin: 0, color: t.textMuted, fontWeight: 700 }}>{p.label}</dt>
      <dd style={{ margin: 0, color: t.textPrimary, wordBreak: "break-word" }}>{p.value}</dd>
    </>
  );
}

function Stat(p: { readonly label: string; readonly value: number | string; readonly text?: boolean }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.bgPage }}>
      <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>{p.label}</div>
      <div style={{ fontSize: p.text ? 11 : 16, fontWeight: 900, marginTop: 2 }}>{p.value}</div>
    </div>
  );
}

function formatSynced(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}
