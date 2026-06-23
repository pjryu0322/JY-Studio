"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useId, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import {
  collectExplainabilityRelatedForChips,
  StructureExplainabilityRelatedChips,
} from "@/components/project-graph/StructureExplainabilityRelatedChips";
import {
  formatConfidenceLabelForDisplay,
  type StructureExplainability,
  type StructureExplainabilityConfidenceLabel,
} from "@/lib/project-structure/structureExplainabilityModel";

const confidenceColors: Record<StructureExplainabilityConfidenceLabel, { bg: string; color: string; border: string }> = {
  HIGH: { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  MEDIUM: { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  LOW: { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
};

const panelStyle: CSSProperties = {
  marginTop: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: t.textMuted,
  marginBottom: 6,
  textTransform: "none",
};

export function StructureConfidenceBadge({
  label,
  percent,
}: {
  readonly label: string;
  readonly percent?: number;
}) {
  const normalized =
    label === "HIGH" || label === "MEDIUM" || label === "LOW"
      ? label
      : label === "High"
        ? "HIGH"
        : label === "Medium"
          ? "MEDIUM"
          : label === "Low"
            ? "LOW"
            : "MEDIUM";
  const style = confidenceColors[normalized as StructureExplainabilityConfidenceLabel];
  const display = formatConfidenceLabelForDisplay(normalized as StructureExplainabilityConfidenceLabel);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        minHeight: 32,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.color,
      }}
    >
      신뢰도 {display}
      {typeof percent === "number" ? ` ${percent}%` : ""}
    </span>
  );
}

export function StructureExplainabilityPanel({
  explainability,
  title = "생성 근거",
  onSelectRelatedNodeId,
  compact = false,
}: {
  readonly explainability: StructureExplainability | null;
  readonly title?: string;
  readonly onSelectRelatedNodeId?: (nodeId: string) => void;
  readonly compact?: boolean;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedId = useId();

  const toggleAdvanced = useCallback(() => {
    setAdvancedOpen((v) => !v);
  }, []);

  const onAdvancedKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleAdvanced();
      }
    },
    [toggleAdvanced],
  );

  if (!explainability) {
    return (
      <section style={panelStyle} aria-label="노드 생성 정보">
        {!compact ? (
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: t.textSecondary }}>{title}</h3>
        ) : null}
        <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>생성 근거 정보를 불러오지 못했습니다.</p>
      </section>
    );
  }

  const relatedItems = collectExplainabilityRelatedForChips(explainability);

  return (
    <section style={panelStyle} aria-label="노드 생성 정보">
      {!compact ? (
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: t.textSecondary }}>{title}</h3>
      ) : null}

      <div>
        <div style={sectionLabel}>생성 근거</div>
        <blockquote
          style={{
            margin: 0,
            fontSize: 14,
            color: t.textPrimary,
            lineHeight: 1.5,
            borderLeft: `3px solid ${t.primary}`,
            paddingLeft: 10,
          }}
        >
          {explainability.sourceConversation.excerpt}
        </blockquote>
      </div>

      <div>
        <div style={sectionLabel}>생성 이유</div>
        <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.55 }}>{explainability.reason}</p>
      </div>

      <div>
        <div style={sectionLabel}>신뢰도</div>
        <StructureConfidenceBadge label={explainability.confidenceLabel} percent={explainability.confidence} />
      </div>

      <div>
        <div style={sectionLabel}>관련 노드</div>
        <StructureExplainabilityRelatedChips items={relatedItems} onSelectNodeId={onSelectRelatedNodeId} />
      </div>

      {explainability.sourceConversation.href ? (
        <div>
          <Link
            href={explainability.sourceConversation.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 800,
              color: t.primary,
              textDecoration: "none",
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              background: t.bgCard,
            }}
          >
            대화 위치로 이동
          </Link>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          aria-expanded={advancedOpen}
          aria-controls={advancedId}
          onClick={toggleAdvanced}
          onKeyDown={onAdvancedKeyDown}
          style={{
            width: "100%",
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${t.border}`,
            background: t.bgPage,
            fontSize: 13,
            fontWeight: 800,
            color: t.textPrimary,
            cursor: "pointer",
          }}
        >
          상세 생성 정보
          <span aria-hidden style={{ color: t.textMuted }}>
            {advancedOpen ? "▲" : "▼"}
          </span>
        </button>
        {advancedOpen ? (
          <div
            id={advancedId}
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              background: "#f8fafc",
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {explainability.confidenceReason ? (
              <div>
                <div style={{ fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>Confidence Detail</div>
                <p style={{ margin: 0, color: t.textSecondary, lineHeight: 1.5 }}>{explainability.confidenceReason}</p>
              </div>
            ) : null}
            <div>
              <div style={{ fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>Source Event</div>
              <div style={{ color: t.textPrimary }}>
                {explainability.sourceEvent.eventType}
                {explainability.sourceEvent.eventId ? ` (${explainability.sourceEvent.eventId})` : ""}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>Created By</div>
              <div>{explainability.createdBy}</div>
            </div>
            <div>
              <div style={{ fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>Created From</div>
              <div>
                Event {explainability.createdFrom.eventId ?? "—"}, Message {explainability.createdFrom.messageId ?? "—"}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
