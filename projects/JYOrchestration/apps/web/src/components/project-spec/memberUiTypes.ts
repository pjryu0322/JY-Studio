import type { ProjectRole } from "@/lib/auth/roles";

export type ProjectMemberUiRow = {
  memberId: string;
  userId: string | null;
  displayName: string;
  role: ProjectRole;
  memberType: "HUMAN" | "AI";
  aiProvider: string | null;
  aiOrchestrationRole?: string | null;
  orchestrationStage?: string | null;
  aiModelOverride?: string | null;
  orchestrationEnabled?: boolean;
  aiActionApprovalModeOverride?: string | null;
  aiActionApplyModeOverride?: string | null;
  isOwner: boolean;
};
