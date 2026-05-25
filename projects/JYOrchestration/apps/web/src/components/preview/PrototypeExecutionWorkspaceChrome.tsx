"use client";

import type { ReactNode } from "react";
import { WorkspaceProgressPill, type WorkspaceIdeationInterviewProgressUi } from "@/components/workspace/WorkspaceProgressPill";

export function PrototypeExecutionWorkspaceChrome({
  statusPill,
  planningProgressUi,
}: {
  readonly statusPill: ReactNode;
  readonly planningProgressUi: WorkspaceIdeationInterviewProgressUi;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        minWidth: 0,
        flex: "1 1 auto",
      }}
    >
      {statusPill}
      <WorkspaceProgressPill interviewUi={planningProgressUi} />
    </div>
  );
}
