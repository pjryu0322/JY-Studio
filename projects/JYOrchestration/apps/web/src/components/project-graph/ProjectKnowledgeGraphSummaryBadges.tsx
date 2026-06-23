"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { ProjectGraphSummaryCounts } from "@/lib/project-graph/projectGraphSummaryCounts";

export function ProjectKnowledgeGraphSummaryBadges(p: { readonly counts: ProjectGraphSummaryCounts }) {
  const items: { readonly label: string; readonly value: number }[] = [
    { label: "Nodes", value: p.counts.nodes },
    { label: "Edges", value: p.counts.edges },
    { label: "Requirements", value: p.counts.requirements },
    { label: "Features", value: p.counts.features },
    { label: "Actors", value: p.counts.actors },
  ];

  return (
    <div
      data-testid="project-knowledge-graph-summary-badges"
      role="group"
      aria-label="그래프 요약"
      style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}
    >
      {items.map((item) => (
        <span
          key={item.label}
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: "4px 10px",
            borderRadius: 999,
            border: `1px solid ${t.border}`,
            background: t.bgPage,
            color: t.textSecondary,
          }}
        >
          {item.label} {item.value}
        </span>
      ))}
    </div>
  );
}
