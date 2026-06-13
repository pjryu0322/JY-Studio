"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { ImplementationExecutionLogPanelContent } from "@/components/preview/ImplementationExecutionLogPanelContent";

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panel: CSSProperties = {
  width: "min(920px, 100%)",
  maxHeight: "min(88vh, 820px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  borderRadius: 16,
  background: "#fafbfc",
  boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.35)",
  border: "1px solid #e2e8f0",
};

export function ImplementationExecutionLogModal(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly exportBaseName?: string | null;
  readonly onClearExecutionLog?: () => void | Promise<void>;
}): ReactNode {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="실행 로그"
      data-testid="implementation-execution-log-modal"
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "16px 18px 22px",
          }}
        >
          <ImplementationExecutionLogPanelContent
            promptTimeline={props.promptTimeline}
            exportBaseName={props.exportBaseName}
            onClearExecutionLog={props.onClearExecutionLog}
          />
        </div>
      </div>
    </div>
  );
}
