import type { ReactNode } from "react";
import type { AppFlowStepId } from "@/lib/workflow/flow-state";

function ServicePlanningIcon({ size = 18 }: { readonly size?: number }) {
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      <path d="M10 13h8" />
      <path d="M10 17h5" />
    </svg>
  );
}

function RocketIcon({ size = 18 }: { readonly size?: number }) {
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
      <path d="M5 13c4 0 7-2 9-6 2 4 2 9-1 12-3 3-8 3-12 1 2-2 4-5 4-7Z" />
      <path d="M9 9l6 6" />
      <path d="M14 4c3 0 6 3 6 6-2 1-4 2-6 2" />
    </svg>
  );
}

function EyeIcon({ size = 18 }: { readonly size?: number }) {
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
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** 프로젝트 레일 단계 아이콘 (SingleChat 통합 이후 SVG 사용). */
export function workflowStepRailGlyph(stepId: AppFlowStepId): ReactNode {
  switch (stepId) {
    case "requirements":
      return <ServicePlanningIcon />;
    case "execution":
      return <RocketIcon />;
    case "prototype_review":
      return <EyeIcon />;
    default:
      return "•";
  }
}

