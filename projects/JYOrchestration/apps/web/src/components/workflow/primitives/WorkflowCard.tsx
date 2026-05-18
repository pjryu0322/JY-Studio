import type { CSSProperties, ReactNode } from "react";

export function WorkflowCard({
  children,
  padding = 14,
  style,
}: {
  children: ReactNode;
  padding?: number;
  style?: CSSProperties;
}) {
  const base: CSSProperties = { border: "1px solid #e5e5e5", borderRadius: 12, padding };
  return <div style={{ ...base, ...style }}>{children}</div>;
}

