import type { CSSProperties, ReactNode } from "react";

const base: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.04em",
  color: "#6b7280",
  textTransform: "uppercase",
};

export function WorkflowSectionLabel({ children, marginBottom }: { children: ReactNode; marginBottom?: number }) {
  return <div style={{ ...base, ...(marginBottom !== undefined ? { marginBottom } : {}) }}>{children}</div>;
}
