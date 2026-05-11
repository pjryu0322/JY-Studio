import type { ReactNode } from "react";
import type { AppFlowStepId } from "@/lib/workflow/flow-state";

function FolderKanbanIcon({ size = 16 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01" />
    </svg>
  );
}

function ListTodoIcon({ size = 16 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="6" height="6" rx="1" />
      <path d="m7 10 1.5 1.5L11 8" />
      <path d="M13 6h8M13 12h8M13 18h8" />
    </svg>
  );
}

function FileTextIcon({ size = 16 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

/** 프로젝트 레일 단계 아이콘 (레이블은 `ProjectRailWorkflowStrip`에서 표시). */
export function workflowStepRailGlyph(stepId: AppFlowStepId): ReactNode {
  switch (stepId) {
    case "requirements":
      return <FolderKanbanIcon />;
    case "execution":
      return <ListTodoIcon />;
    case "prototype_review":
      return <FileTextIcon />;
    default:
      return "•";
  }
}
