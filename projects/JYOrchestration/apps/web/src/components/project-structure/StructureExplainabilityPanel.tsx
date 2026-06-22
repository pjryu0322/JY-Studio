"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import {
  formatConfidenceLabelForDisplay,
  type StructureExplainability,
  type StructureExplainabilityConfidenceLabel,
  type StructureExplainabilityRelatedNode,
} from "@/lib/project-structure/structureExplainabilityModel";

const confidenceColors: Record<StructureExplainabilityConfidenceLabel, { bg: string; color: string; border: string }> = {
  HIGH: { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  MEDIUM: { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  LOW: { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
};

const panelStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 10,
  border: `1px solid ${t.border}`,
  background: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  gap: 10,
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
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.color,
      }}
    >
      {display}
      {typeof percent === "number" ? ` ${percent}%` : ""}
    </span>
  );
}

export function StructureExplainabilityPanel({
  explainability,
  title = "생성 근거",
  onSelectRelatedNodeId,
}: {
  readonly explainability: StructureExplainability | null;
  readonly title?: string;
  readonly onSelectRelatedNodeId?: (nodeId: string) => void;
}) {
  if (!explainability) {
    return (
      <section style={panelStyle} aria-label="Explainability">
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: t.textSecondary }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>Explainability 정보를 불러오지 못했습니다.</p>
      </section>
    );
  }

  return (
    <section style={panelStyle} aria-label="Explainability">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: t.textSecondary }}>{title}</h3>
        <StructureConfidenceBadge label={explainability.confidenceLabel} percent={explainability.confidence} />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>Source Conversation</div>
        <blockquote
          style={{
            margin: 0,
            fontSize: 13,
            color: t.textPrimary,
            fontStyle: "italic",
            borderLeft: `3px solid ${t.primary}`,
            paddingLeft: 10,
          }}
        >
          {explainability.sourceConversation.excerpt}
        </blockquote>
        {explainability.sourceConversation.href ? (
          <Link
            href={explainability.sourceConversation.href}
            style={{ fontSize: 12, fontWeight: 700, color: t.primary, marginTop: 6, display: "inline-block" }}
          >
            대화 위치로 이동
          </Link>
        ) : null}
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>Reason</div>
        <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{explainability.reason}</p>
      </div>

      {explainability.confidenceReason ? (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>Confidence Reason</div>
          <p style={{ margin: 0, fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>{explainability.confidenceReason}</p>
        </div>
      ) : null}

      <ExplainabilityRelatedSections explainability={explainability} onSelectNodeId={onSelectRelatedNodeId} />

      <dl style={{ margin: 0, fontSize: 12, display: "grid", gap: 6 }}>
        <div>
          <dt style={{ fontWeight: 700, color: t.textMuted, display: "inline" }}>Source Event: </dt>
          <dd style={{ display: "inline", margin: 0, color: t.textPrimary }}>
            {explainability.sourceEvent.eventType}
            {explainability.sourceEvent.eventId ? ` (${explainability.sourceEvent.eventId})` : ""}
          </dd>
        </div>
        <div>
          <dt style={{ fontWeight: 700, color: t.textMuted, display: "inline" }}>Created By: </dt>
          <dd style={{ display: "inline", margin: 0 }}>{explainability.createdBy}</dd>
        </div>
        <div>
          <dt style={{ fontWeight: 700, color: t.textMuted, display: "inline" }}>Created From: </dt>
          <dd style={{ display: "inline", margin: 0 }}>
            Event {explainability.createdFrom.eventId ?? "—"}, Message {explainability.createdFrom.messageId ?? "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function RelatedList({
  label,
  items,
  onSelectNodeId,
}: {
  readonly label: string;
  readonly items: readonly StructureExplainabilityRelatedNode[];
  readonly onSelectNodeId?: (nodeId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>{label}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.textSecondary }}>
        {items.map((r) => (
          <li key={`${r.direction}-${r.nodeId}-${r.edgeType}`}>
            {onSelectNodeId ? (
              <button
                type="button"
                onClick={() => onSelectNodeId(r.nodeId)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  color: t.primary,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                {r.title}
              </button>
            ) : (
              r.title
            )}{" "}
            <span style={{ color: t.textMuted }}>
              ({r.nodeType} · {r.edgeType} · {r.direction === "IN" ? "←" : "→"})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExplainabilityRelatedSections({
  explainability,
  onSelectNodeId,
}: {
  readonly explainability: StructureExplainability;
  readonly onSelectNodeId?: (nodeId: string) => void;
}) {
  const art = explainability.relatedArtifacts;
  const hasAny =
    explainability.relatedNodes.length > 0 ||
    art.features.length > 0 ||
    art.screens.length > 0 ||
    art.reviews.length > 0 ||
    art.changeRequests.length > 0 ||
    art.flows.length > 0 ||
    art.tasks.length > 0;
  if (!hasAny) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: t.textSecondary }}>Related</div>
      <RelatedList label="Related Nodes" items={explainability.relatedNodes} onSelectNodeId={onSelectNodeId} />
      <RelatedList label="Related Features" items={art.features} onSelectNodeId={onSelectNodeId} />
      <RelatedList label="Related Screens" items={art.screens} onSelectNodeId={onSelectNodeId} />
      <RelatedList label="Related Reviews" items={art.reviews} onSelectNodeId={onSelectNodeId} />
      <RelatedList label="Related Change Requests" items={art.changeRequests} onSelectNodeId={onSelectNodeId} />
      <RelatedList label="Related Flows" items={art.flows} onSelectNodeId={onSelectNodeId} />
      <RelatedList label="Related Tasks" items={art.tasks} onSelectNodeId={onSelectNodeId} />
    </div>
  );
}
