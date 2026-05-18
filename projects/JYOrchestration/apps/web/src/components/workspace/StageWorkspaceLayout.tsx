"use client";

import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

const baseline: CSSProperties = {
  minHeight: "min(72vh, 720px)",
  boxSizing: "border-box",
  background: t.bgPage,
  border: `1px solid ${t.border}`,
  borderRadius: t.radiusLg,
  overflow: "hidden",
};

/**
 * Workflow stage workspace baseline.
 * - Keep a consistent minimum height across top stage tabs.
 * - Avoid layout jump when content is short.
 *
 * NOTE: This component intentionally does not own the page header / tabs strip.
 *       Callers should render header/nav above, then wrap the stage body with this.
 */
export function StageWorkspaceLayout({
  children,
  style,
  className,
}: {
  readonly children: ReactNode;
  readonly style?: CSSProperties;
  readonly className?: string;
}) {
  return (
    <section
      className={["jyo-stage-workspace-baseline", className].filter(Boolean).join(" ")}
      style={{ ...baseline, flex: "1 1 auto", minWidth: 0, ...style }}
      aria-label="단계 워크스페이스"
    >
      {children}
    </section>
  );
}

