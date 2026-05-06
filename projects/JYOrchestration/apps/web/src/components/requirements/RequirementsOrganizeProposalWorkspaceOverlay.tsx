"use client";

import { OrganizeProposalDraggableModal } from "@/components/requirements/OrganizeProposalDraggableModal";

export type RequirementsOrganizeProposalWorkspaceOverlayProps = Readonly<{
  open: boolean;
  onClose: () => void;
  busy: boolean;
  deliverableGenerateBusy: boolean;
  organizeRunning: boolean;
  showRegenerate: boolean;
  regenerateDisabled: boolean;
  onRegenerate: () => void;
  onStartOrganize: () => void | Promise<void>;
  /** 기획안 이름 앞에 붙는 프로젝트명 등 (예: 이름 미정 시 "프로젝트") */
  planSubjectName: string;
}>;

export function RequirementsOrganizeProposalWorkspaceOverlay({
  open,
  onClose,
  busy,
  deliverableGenerateBusy,
  organizeRunning,
  showRegenerate,
  regenerateDisabled,
  onRegenerate,
  onStartOrganize,
  planSubjectName,
}: RequirementsOrganizeProposalWorkspaceOverlayProps) {
  return (
    <OrganizeProposalDraggableModal
      open={open}
      onClose={onClose}
      busy={busy || deliverableGenerateBusy || organizeRunning}
      showRegenerate={showRegenerate}
      regenerateDisabled={regenerateDisabled}
      onRegenerate={onRegenerate}
      onStart={() => void onStartOrganize()}
    >
      <div>
        현재 확보된 내용을 바탕으로{" "}
        <strong style={{ color: "#0f172a" }}>
          {planSubjectName} 기획안
        </strong>
        을 생성합니다.
      </div>
    </OrganizeProposalDraggableModal>
  );
}
