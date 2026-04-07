import { ReactNode } from "react";

export function WorkflowCard({
  children,
  padding = 14,
}: {
  children: ReactNode;
  padding?: number;
}) {
  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding }}>
      {children}
    </div>
  );
}

