export type ProjectRole = "OWNER" | "EDITOR" | "REVIEWER" | "VIEWER";

export type ProjectPermissionKey =
  | "canViewProject"
  | "canEditProject"
  | "canGenerateTask"
  | "canRunTask"
  | "canReorderTask"
  | "canCreatePrompt"
  | "canRegisterGitRequest"
  | "canApplyGit"
  | "canReviewGit"
  | "canChangeGitPolicy"
  | "canViewExecution"
  | "canControlExecution"
  /** OWNER/EDITOR: AI 멤버에 초안·QA·요약 등 액션 요청 */
  | "canRequestAiMemberAction"
  /** OWNER/EDITOR/REVIEWER: AI 리뷰 요청 */
  | "canRequestAiReviewAction"
  /** OWNER/EDITOR: AI 액션 수동 디스패치·run-once */
  | "canDispatchAiMemberAction"
  | "canEdit"
  | "canRun"
  | "canApprove"
  | "canReorder"
  | "canView";

export const RolePermissions: Record<ProjectRole, Record<ProjectPermissionKey, boolean>> = {
  OWNER: {
    canViewProject: true,
    canEditProject: true,
    canGenerateTask: true,
    canRunTask: true,
    canReorderTask: true,
    canCreatePrompt: true,
    canRegisterGitRequest: true,
    canApplyGit: true,
    canReviewGit: true,
    canChangeGitPolicy: true,
    canViewExecution: true,
    canControlExecution: true,
    canRequestAiMemberAction: true,
    canRequestAiReviewAction: true,
    canDispatchAiMemberAction: true,
    canEdit: true,
    canRun: true,
    canApprove: true,
    canReorder: true,
    canView: true,
  },
  EDITOR: {
    canViewProject: true,
    canEditProject: false,
    canGenerateTask: true,
    canRunTask: true,
    canReorderTask: true,
    canCreatePrompt: true,
    canRegisterGitRequest: true,
    canApplyGit: true,
    canReviewGit: false,
    canChangeGitPolicy: false,
    canViewExecution: true,
    canControlExecution: true,
    canRequestAiMemberAction: true,
    canRequestAiReviewAction: true,
    canDispatchAiMemberAction: true,
    canEdit: true,
    canRun: true,
    canApprove: false,
    canReorder: true,
    canView: true,
  },
  REVIEWER: {
    canViewProject: true,
    canEditProject: false,
    canGenerateTask: false,
    canRunTask: false,
    canReorderTask: false,
    canCreatePrompt: false,
    canRegisterGitRequest: false,
    canApplyGit: false,
    canReviewGit: true,
    canChangeGitPolicy: false,
    canViewExecution: true,
    canControlExecution: false,
    canRequestAiMemberAction: false,
    canRequestAiReviewAction: true,
    canDispatchAiMemberAction: false,
    canEdit: false,
    canRun: false,
    canApprove: true,
    canReorder: false,
    canView: true,
  },
  VIEWER: {
    canViewProject: true,
    canEditProject: false,
    canGenerateTask: false,
    canRunTask: false,
    canReorderTask: false,
    canCreatePrompt: false,
    canRegisterGitRequest: false,
    canApplyGit: false,
    canReviewGit: false,
    canChangeGitPolicy: false,
    canViewExecution: true,
    canControlExecution: false,
    canRequestAiMemberAction: false,
    canRequestAiReviewAction: false,
    canDispatchAiMemberAction: false,
    canEdit: false,
    canRun: false,
    canApprove: false,
    canReorder: false,
    canView: true,
  },
};
