"use client";

import type { ReactNode } from "react";
import { WorkspaceHubChromeIconButton } from "@/components/workspace/WorkspaceHubChromeIconButton";
import { WorkspaceProgressPill, type WorkspaceIdeationInterviewProgressUi } from "@/components/workspace/WorkspaceProgressPill";

function ArtifactHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

export function PrototypeExecutionWorkspaceChrome({
  statusPill,
  artifactHubCount,
  artifactHubHasStale,
  showArtifactHubBadge,
  onOpenArtifactHub,
  planningProgressUi,
}: {
  readonly statusPill: ReactNode;
  readonly artifactHubCount: number;
  readonly artifactHubHasStale: boolean;
  readonly showArtifactHubBadge: boolean;
  readonly onOpenArtifactHub: () => void;
  readonly planningProgressUi: WorkspaceIdeationInterviewProgressUi | null;
}) {
  const hubBadge = showArtifactHubBadge ? artifactHubCount : 0;

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
      {planningProgressUi ? <WorkspaceProgressPill interviewUi={planningProgressUi} /> : null}
      <WorkspaceHubChromeIconButton
        title={
          hubBadge > 0 ? `Artifact Hub — 완성 산출물 ${hubBadge}건` : "Artifact Hub — 기획 산출물"
        }
        ariaLabel={
          hubBadge > 0 ? `Artifact Hub 열기, 완성 산출물 ${hubBadge}건` : "Artifact Hub 열기"
        }
        badge={hubBadge > 0 ? hubBadge : undefined}
        badgeTone={artifactHubHasStale ? "stale" : "default"}
        onClick={onOpenArtifactHub}
      >
        <ArtifactHubIcon />
      </WorkspaceHubChromeIconButton>
    </div>
  );
}
