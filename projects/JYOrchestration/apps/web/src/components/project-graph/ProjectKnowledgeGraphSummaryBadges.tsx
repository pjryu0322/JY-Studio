"use client";

import { useState, type CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { useGraphMobileUx } from "@/components/project-graph/useGraphMobileUx";
import type { ProjectGraphSummaryCounts } from "@/lib/project-graph/projectGraphSummaryCounts";

function badgeStyle(): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 800,
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: t.bgPage,
    color: t.textSecondary,
  };
}

export function ProjectKnowledgeGraphSummaryBadges(p: { readonly counts: ProjectGraphSummaryCounts }) {
  const graphMobileUx = useGraphMobileUx();
  const [showDetail, setShowDetail] = useState(false);

  const primary: { readonly label: string; readonly value: number }[] = [
    { label: "Nodes", value: p.counts.nodes },
    { label: "Edges", value: p.counts.edges },
  ];
  const detail: { readonly label: string; readonly value: number }[] = [
    { label: "Requirements", value: p.counts.requirements },
    { label: "Features", value: p.counts.features },
    { label: "Actors", value: p.counts.actors },
  ];

  const compact = graphMobileUx && !showDetail;
  const items = compact ? primary : [...primary, ...detail];

  return (
    <div
      data-testid="project-knowledge-graph-summary-badges"
      role="group"
      aria-label="그래프 요약"
      style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}
    >
      {items.map((item) => (
        <span key={item.label} style={badgeStyle()}>
          {item.label} {item.value}
        </span>
      ))}
      {graphMobileUx ? (
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          aria-expanded={showDetail}
          aria-label={showDetail ? "요약 상세 접기" : "요약 상세 보기"}
          style={{
            ...badgeStyle(),
            minHeight: 44,
            cursor: "pointer",
            font: "inherit",
          }}
        >
          {showDetail ? "간단히" : "상세 보기"}
        </button>
      ) : null}
    </div>
  );
}
