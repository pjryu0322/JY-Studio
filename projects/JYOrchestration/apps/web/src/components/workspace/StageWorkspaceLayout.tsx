"use client";

import type { CSSProperties, ReactNode } from "react";

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
      style={style}
      aria-label="단계 워크스페이스"
    >
      {children}
    </section>
  );
}

