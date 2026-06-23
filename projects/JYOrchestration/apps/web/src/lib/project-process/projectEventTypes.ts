export const PROJECT_EVENT_TYPES = {
  PROJECT_CREATED: "project.created",
  IDEA_CREATED: "idea.created",
  CONVERSATION_MESSAGE_CREATED: "conversation.message_created",
  REQUIREMENTS_STATE_SAVED: "requirements.state_saved",
  PLANNING_SNAPSHOT_CREATED: "planning.snapshot_created",
} as const;

export type ProjectEventType = (typeof PROJECT_EVENT_TYPES)[keyof typeof PROJECT_EVENT_TYPES];

export const PROJECT_PROCESS_STAGES = {
  PROJECT_CREATE: "project_create",
  REQUIREMENTS_IDEATION: "requirements_ideation",
  REQUIREMENTS_SERVICE_FLOW: "requirements_service_flow",
  FEATURE_PLANNING: "feature_planning",
  PROTOTYPE_BUILD: "prototype_build",
  PROTOTYPE_REVIEW: "prototype_review",
  SPEC_WORKSPACE: "spec_workspace",
} as const;

export type ProjectProcessStage = (typeof PROJECT_PROCESS_STAGES)[keyof typeof PROJECT_PROCESS_STAGES];

export const PROJECT_MESSAGE_SOURCES = {
  REQUIREMENTS_CONVERSATION: "requirements_conversation",
} as const;
