"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type {
  ProjectGraphActivityFeedRow,
  ProjectGraphActivitySummary,
} from "@/lib/project-graph/projectGraphActivityClient";
import { toUserFriendlyGraphActivityLine } from "@/lib/project-graph/projectKnowledgeGraphActivityUserText";

export function ProjectKnowledgeGraphActivityPanel(p: {
  readonly projectId: string;
  readonly summary: ProjectGraphActivitySummary | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly highlightSourceMessageId: string | null;
  readonly showTimeline?: boolean;
  readonly userMode?: boolean;
  readonly onRefresh: () => void;
}) {
  const s = p.summary;
  const showTimeline = p.showTimeline !== false;
  const userMode = p.userMode !== false;
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
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: t.textPrimary }}>
          {userMode ? "최근 반영 내용" : "Knowledge Graph 생성 현황"}
        </h2>
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
        {userMode
          ? "최근에 프로젝트 구조에 반영된 내용입니다."
          : "Activity 항목을 선택하면 요약과 생성 결과를 확인할 수 있습니다."}
      </p>

      {p.error ? <p style={{ margin: "0 0 8px", color: "#b91c1c", fontSize: 12 }}>{p.error}</p> : null}

      {s ? (
        <>
          {!userMode ? (
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
          ) : null}

          {showTimeline ? (
            <>
              {!userMode ? (
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: t.textSecondary }}>Activity</div>
              ) : null}
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                {s.feed.length === 0 ? (
                  <li style={{ fontSize: 12, color: t.textMuted }}>표시할 활동이 없습니다.</li>
                ) : (
                  s.feed.map((row) => (
                    <ActivityFeedRowButton
                      key={row.id}
                      row={row}
                      displayLine={userMode ? toUserFriendlyGraphActivityLine(row) : row.line}
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

              {selectedRow ? (
                <ActivityFeedDetail row={selectedRow} projectId={p.projectId.trim()} userMode={userMode} />
              ) : null}
            </>
          ) : null}
        </>
      ) : p.loading ? (
        <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>생성 현황 불러오는 중…</p>
      ) : null}
    </section>
  );
}

function ActivityFeedRowButton(p: {
  readonly row: ProjectGraphActivityFeedRow;
  readonly displayLine: string;
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
        {p.displayLine}
      </button>
    </li>
  );
}

function ActivityFeedDetail(p: {
  readonly row: ProjectGraphActivityFeedRow;
  readonly projectId: string;
  readonly userMode?: boolean;
}) {
  const { row } = p;
  if (row.detail.view === "planning_snapshot" && row.detail.planningSnapshot) {
    return <PlanningSnapshotActivityDetail row={row} snapshot={row.detail.planningSnapshot} userMode={p.userMode} />;
  }
  if (row.detail.view === "group_summary" && row.detail.groupSummary) {
    return <GroupSummaryActivityDetail row={row} projectId={p.projectId} />;
  }
  return <DefaultActivityFeedDetail row={row} userMode={p.userMode} />;
}

function PlanningSnapshotActivityDetail(p: {
  readonly row: ProjectGraphActivityFeedRow;
  readonly snapshot: NonNullable<ProjectGraphActivityFeedRow["detail"]["planningSnapshot"]>;
  readonly userMode?: boolean;
}) {
  const snap = p.snapshot;
  const counts = snap.candidateCountsByType;

  return (
    <div
      data-testid="project-knowledge-graph-activity-detail"
      style={detailShellStyle}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <header>
          <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 900, color: t.textPrimary }}>
            Planning Snapshot 생성
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.55 }}>
            AI 기획자가 프로젝트 초기 구조를 정리했습니다.
          </p>
        </header>

        <div style={summaryCardStyle}>
          <div style={{ fontSize: 16, fontWeight: 900, color: t.textPrimary }}>{snap.productName}</div>
          {snap.summary ? (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: t.textSecondary, lineHeight: 1.55 }}>{snap.summary}</p>
          ) : null}
          <ChipSection label="해결 문제" items={snap.problems} />
          <ChipSection label="주요 사용자" items={snap.actors} />
          <ChipSection label="핵심 기능" items={snap.features} />
        </div>

        <div>
          <div style={sectionTitleStyle}>생성된 후보</div>
          <div style={countGridStyle}>
            {Object.entries(counts).map(([type, count]) => (
              <CountCard key={type} label={type} count={count} />
            ))}
          </div>
        </div>

        <div>
          <div style={sectionTitleStyle}>Graph 반영 상태</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {snap.statusBadges.map((badge) => (
              <StatusBadge key={badge} label={badge} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {snap.requirementsHref ? (
            <ActionLink href={snap.requirementsHref} label="원본 대화 보기" primary />
          ) : null}
          {snap.structureReviewHref ? (
            <ActionLink href={snap.structureReviewHref} label="구조 후보 검토" />
          ) : null}
        </div>

        {!p.userMode ? <DeveloperDetailsAccordion row={p.row} /> : null}
      </div>
    </div>
  );
}

function GroupSummaryActivityDetail(p: { readonly row: ProjectGraphActivityFeedRow; readonly projectId: string }) {
  const g = p.row.detail.groupSummary!;
  const pid = p.projectId.trim();
  const structureReviewHref = pid ? `/projects/${encodeURIComponent(pid)}/structure-review` : null;
  const line =
    g.nodeType === "GraphEdge"
      ? `Graph Edge ${g.count}개가 생성되었습니다.`
      : `${g.nodeType} 후보 ${g.count}개가 생성되었습니다.`;

  return (
    <div data-testid="project-knowledge-graph-activity-detail" style={detailShellStyle}>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{line}</p>
      {structureReviewHref ? <ActionLink href={structureReviewHref} label="구조 후보 검토" /> : null}
    </div>
  );
}

function DefaultActivityFeedDetail({
  row,
  userMode,
}: {
  readonly row: ProjectGraphActivityFeedRow;
  readonly userMode?: boolean;
}) {
  const d = row.detail;
  const headline = userMode ? toUserFriendlyGraphActivityLine(row) : row.line;
  return (
    <div data-testid="project-knowledge-graph-activity-detail" style={detailShellStyle}>
      <div style={{ fontWeight: 900, marginBottom: 8, color: t.textPrimary }}>{headline}</div>
      {d.title ? <p style={{ margin: "0 0 6px", color: t.textPrimary }}>{d.title}</p> : null}
      {d.summary ? (
        <p style={{ margin: "0 0 8px", color: t.textSecondary, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{d.summary}</p>
      ) : null}
      {d.lifecycleStatus && !userMode ? (
        <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
          상태: <strong>{d.lifecycleStatus}</strong>
        </p>
      ) : null}
      {!userMode ? <DeveloperDetailsAccordion row={row} /> : null}
    </div>
  );
}

function DeveloperDetailsAccordion({ row }: { readonly row: ProjectGraphActivityFeedRow }) {
  const d = row.detail;
  const hasDevInfo = Boolean(d.eventType || d.stage || row.sourceMessageId || d.entityId || d.rawPayloadJson);
  if (!hasDevInfo) return null;

  return (
    <details style={{ marginTop: 4 }}>
      <summary
        style={{
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 800,
          color: t.textSecondary,
          minHeight: 36,
          display: "flex",
          alignItems: "center",
        }}
      >
        상세 기술 정보 보기
      </summary>
      <dl
        style={{
          margin: "8px 0 0",
          display: "grid",
          gridTemplateColumns: "minmax(88px, 110px) 1fr",
          gap: "4px 10px",
          fontSize: 12,
        }}
      >
        {d.eventType ? <DetailTerm label="Event Type" value={d.eventType} /> : null}
        {d.stage ? <DetailTerm label="Stage" value={d.stage} /> : null}
        {row.sourceMessageId ? <DetailTerm label="sourceMessageId" value={row.sourceMessageId} /> : null}
        {d.entityId ? <DetailTerm label="Event ID" value={d.entityId} /> : null}
      </dl>
      {d.rawPayloadJson ? (
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
          {d.rawPayloadJson}
        </pre>
      ) : null}
    </details>
  );
}

function ChipSection(p: { readonly label: string; readonly items: readonly string[] }) {
  if (p.items.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 6 }}>{p.label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {p.items.map((item) => (
          <span key={item} style={chipStyle}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function CountCard(p: { readonly label: string; readonly count: number }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgPage }}>
      <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>{p.label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{p.count}개</div>
    </div>
  );
}

function StatusBadge(p: { readonly label: string }) {
  const tone =
    p.label === "승인 대기"
      ? { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" }
      : p.label === "Graph 반영 완료"
        ? { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" }
        : { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        background: tone.bg,
        color: tone.color,
        border: `1px solid ${tone.border}`,
      }}
    >
      {p.label}
    </span>
  );
}

function ActionLink(p: { readonly href: string; readonly label: string; readonly primary?: boolean }) {
  return (
    <Link
      href={p.href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 40,
        padding: "8px 14px",
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 800,
        textDecoration: "none",
        border: `1px solid ${p.primary ? t.primary : t.border}`,
        background: p.primary ? "#eff6ff" : t.bgPage,
        color: p.primary ? t.primary : t.textPrimary,
      }}
    >
      {p.label}
    </Link>
  );
}

function DetailTerm(term: { readonly label: string; readonly value: string }) {
  return (
    <>
      <dt style={{ margin: 0, color: t.textMuted, fontWeight: 700 }}>{term.label}</dt>
      <dd style={{ margin: 0, color: t.textPrimary, wordBreak: "break-word" }}>{term.value}</dd>
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

const detailShellStyle: CSSProperties = {
  marginTop: 10,
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${t.border}`,
  background: t.bgPage,
  fontSize: 12,
  lineHeight: 1.5,
};

const summaryCardStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${t.border}`,
  background: t.bgCard,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 8,
  color: t.textSecondary,
};

const countGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: 8,
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  background: t.bgPage,
  border: `1px solid ${t.border}`,
  color: t.textPrimary,
  lineHeight: 1.35,
};
