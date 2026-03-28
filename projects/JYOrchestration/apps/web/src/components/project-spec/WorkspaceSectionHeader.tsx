"use client";

import type { CSSProperties } from "react";
import { WorkspaceLabelBadge } from "@/components/project-spec/WorkspaceLabelBadge";
import { WORKSPACE_SECTION_META, type WorkspaceSectionKey } from "@/components/project-spec/workspaceSectionMeta";

type HeadingTag = "h2" | "h3" | "strong";

const headingStyles: Record<HeadingTag, CSSProperties> = {
  h2: { fontSize: 22, fontWeight: 700, margin: 0 },
  h3: { fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.35 },
  strong: { fontSize: 14, fontWeight: 800, margin: 0 },
};

export function WorkspaceSectionHeader({
  section,
  as = "h3",
  layout = "row",
  marginBottom = 12,
  title: titleOverride,
}: {
  section: WorkspaceSectionKey;
  as?: HeadingTag;
  layout?: "row" | "column";
  marginBottom?: number;
  /** 기본은 meta.title */
  title?: string;
}) {
  const title = titleOverride ?? WORKSPACE_SECTION_META[section].title;
  const style = headingStyles[as];
  const inner =
    as === "h2" ? (
      <h2 style={style}>{title}</h2>
    ) : as === "h3" ? (
      <h3 style={style}>{title}</h3>
    ) : (
      <strong style={style}>{title}</strong>
    );

  if (layout === "column") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 8,
          marginBottom,
        }}
      >
        <WorkspaceLabelBadge section={section} />
        {inner}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        marginBottom,
      }}
    >
      <WorkspaceLabelBadge section={section} />
      {inner}
    </div>
  );
}
