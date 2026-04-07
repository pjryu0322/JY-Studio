import { ReactNode } from "react";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";

export function WorkflowEmptyState({
  title,
  message,
  right,
}: {
  title: string;
  message: string;
  right?: ReactNode;
}) {
  return (
    <WorkflowCard>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>{message}</div>
        </div>
        {right ? <div style={{ flex: "0 0 auto" }}>{right}</div> : null}
      </div>
    </WorkflowCard>
  );
}

