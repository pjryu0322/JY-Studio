"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { KnowledgePipelineRunRecord } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import { buildKnowledgeActivityItems } from "@/lib/project-knowledge/projectKnowledgeActivityBuilder";

export function KnowledgePipelineMonitorPanel(p: {
  readonly run: KnowledgePipelineRunRecord | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
}) {
  const items = p.run ? buildKnowledgeActivityItems({ pipelineRun: p.run }) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 2px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: t.textPrimary }}>Knowledge Activity</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
            Graph 생성 파이프라인 단계 타임라인 (최근 실행)
          </div>
        </div>
        <button
          type="button"
          onClick={p.onRefresh}
          disabled={p.loading}
          style={{
            minHeight: 36,
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.bgPage,
            fontSize: 12,
            fontWeight: 800,
            cursor: p.loading ? "wait" : "pointer",
          }}
        >
          {p.loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {p.error ? (
        <p style={{ fontSize: 12, color: "#b91c1c", margin: 0 }}>{p.error}</p>
      ) : null}

      {!p.loading && !p.run ? (
        <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>
          아직 기록된 파이프라인 실행이 없습니다. 요구사항 저장 후 타임라인이 표시됩니다.
        </p>
      ) : null}

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, index) => (
          <li
            key={item.id}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              background: item.type === "warning" ? "#fff7ed" : "#f8fafc",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                background: item.type === "warning" ? "#fdba74" : "#93c5fd",
                color: "#0f172a",
                fontSize: 11,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {index + 1}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: t.textPrimary }}>{item.title}</div>
              {item.summary ? (
                <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>{item.summary}</div>
              ) : null}
              {item.occurredAt ? (
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                  {new Date(item.occurredAt).toLocaleString("ko-KR")}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
