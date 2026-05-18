import { ReactNode } from "react";

export function WorkflowBadge({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid #e5e5e5",
        background: "#fafafa",
        color: "#374151",
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {children}
    </span>
  );
}

