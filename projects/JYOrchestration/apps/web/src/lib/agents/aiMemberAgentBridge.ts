/**
 * Maps existing Workspace AI member / ProjectMember / Requirements context → AgentDefinition ids.
 * Does not replace platform catalog or dispatch paths.
 */

import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { getAgentById } from "@/lib/agents/agentRegistry";
import type { AgentDefinition } from "@/lib/agents/agentDefinitionTypes";

/** Platform catalog member id → foundation AgentDefinition.id */
export const WORKSPACE_AI_MEMBER_TO_AGENT_ID: Readonly<Record<WorkspaceAiMemberId, string>> = {
  ideation: "ai-planner",
  actor_flow: "ai-analyst",
  feature_planning: "ai-architect",
  designer: "ai-designer",
  prototype_build: "ai-developer",
  prototype_review: "ai-reviewer",
  security_reviewer: "ai-security",
  memo: "ai-operator",
};

/** DB / invite orchestration role strings → foundation agent id */
export const ORCHESTRATION_ROLE_TO_AGENT_ID: Readonly<Partial<Record<string, string>>> = {
  planner: "ai-planner",
  "service-designer": "ai-analyst",
  "domain-expert": "ai-architect",
  analyst: "ai-analyst",
  architect: "ai-architect",
  designer: "ai-designer",
  developer: "ai-developer",
  reviewer: "ai-reviewer",
  "security-reviewer": "ai-security",
  "scm-manager": "ai-scm",
  operator: "ai-operator",
  "orchestration-planner": "ai-planner",
  "orchestration-architect": "ai-architect",
  "orchestration-developer": "ai-developer",
};

/** Loose role / stage / intent tokens → agent id (lowercase match). */
const ROLE_TOKEN_TO_AGENT_ID: Readonly<Record<string, string>> = {
  ideation: "ai-planner",
  planning: "ai-planner",
  actor_flow: "ai-analyst",
  "service-flow": "ai-analyst",
  service_flow: "ai-analyst",
  analysis: "ai-analyst",
  analyst: "ai-analyst",
  feature_detail: "ai-architect",
  feature_planning: "ai-architect",
  architecture: "ai-architect",
  screen_define: "ai-architect",
  api_define: "ai-architect",
  designer: "ai-designer",
  uiux: "ai-designer",
  prototype: "ai-developer",
  prototype_build: "ai-developer",
  implementation: "ai-developer",
  cursor: "ai-developer",
  developer: "ai-developer",
  review: "ai-reviewer",
  prototype_review: "ai-reviewer",
  security: "ai-security",
  security_review: "ai-security",
  scm: "ai-scm",
  pr: "ai-scm",
  merge: "ai-scm",
  memo: "ai-operator",
  operation: "ai-operator",
  governance: "ai-operator",
};

const STAGE_TO_DEFAULT_AGENT_ID: Readonly<Record<string, string>> = {
  IDEATION: "ai-planner",
  SERVICE_FLOW: "ai-analyst",
  SERVICE_FLOW_REVIEW: "ai-analyst",
  FEATURE_DETAIL: "ai-architect",
  SCREEN_DEFINE: "ai-architect",
  API_DEFINE: "ai-architect",
  PROTOTYPE: "ai-developer",
  REVIEW: "ai-reviewer",
};

const QUICK_ACTION_TO_AGENT_ID: Readonly<Partial<Record<string, string>>> = {
  EDIT_FEATURES: "ai-architect",
  DEFINE_SCREEN: "ai-architect",
  DEFINE_API: "ai-architect",
  START_FEATURE_DETAIL: "ai-architect",
  GENERATE_DOCUMENT: "ai-developer",
  EXPORT_MARKDOWN: "ai-developer",
  EXPORT_PDF: "ai-developer",
  OPEN_ARTIFACT_HUB: "ai-developer",
  REVIEW_FLOW: "ai-planner",
  DOCUMENT_FLOW: "ai-planner",
};

export type ProjectMemberAgentBridgeInput = Readonly<{
  readonly aiOrchestrationRole?: string | null;
  readonly aiAgentKey?: string | null;
  readonly displayName?: string | null;
}>;

export type RequirementIntentBridgeInput = Readonly<{
  readonly suggestedActionId?: string | null;
  readonly routerMode?: string | null;
  readonly authoritativeStage?: string | null;
}>;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function mapAiMemberRoleToAgentId(role: string | null | undefined): string | undefined {
  const raw = String(role ?? "").trim();
  if (!raw) return undefined;
  if (ORCHESTRATION_ROLE_TO_AGENT_ID[raw]) return ORCHESTRATION_ROLE_TO_AGENT_ID[raw];
  const norm = normalizeToken(raw);
  return ROLE_TOKEN_TO_AGENT_ID[norm] ?? ORCHESTRATION_ROLE_TO_AGENT_ID[norm];
}

export function mapWorkspaceAiMemberToAgentId(memberId: string): string | undefined {
  const key = memberId as WorkspaceAiMemberId;
  return WORKSPACE_AI_MEMBER_TO_AGENT_ID[key];
}

export function mapProjectMemberToAgentId(member: ProjectMemberAgentBridgeInput): string | undefined {
  const fromRole = mapAiMemberRoleToAgentId(member.aiOrchestrationRole);
  if (fromRole) return fromRole;
  const key = String(member.aiAgentKey ?? "").trim();
  if (key && ORCHESTRATION_ROLE_TO_AGENT_ID[key]) return ORCHESTRATION_ROLE_TO_AGENT_ID[key];
  return undefined;
}

export function mapRequirementIntentToPrimaryAgentId(
  intent: RequirementIntentBridgeInput,
): string | undefined {
  const action = String(intent.suggestedActionId ?? "").trim();
  if (action && QUICK_ACTION_TO_AGENT_ID[action]) return QUICK_ACTION_TO_AGENT_ID[action];

  const stage = String(intent.authoritativeStage ?? "").trim();
  if (stage && STAGE_TO_DEFAULT_AGENT_ID[stage]) return STAGE_TO_DEFAULT_AGENT_ID[stage];

  const mode = normalizeToken(String(intent.routerMode ?? ""));
  if (mode.includes("clarification")) return "ai-planner";
  return undefined;
}

export function getDefaultAgentForStage(stageOrIntent: string | null | undefined): string | undefined {
  const s = String(stageOrIntent ?? "").trim();
  if (!s) return undefined;
  if (STAGE_TO_DEFAULT_AGENT_ID[s]) return STAGE_TO_DEFAULT_AGENT_ID[s];
  return mapAiMemberRoleToAgentId(s);
}

export function resolveAgentDefinitionForWorkspaceMember(
  memberId: WorkspaceAiMemberId,
): AgentDefinition | undefined {
  const agentId = mapWorkspaceAiMemberToAgentId(memberId);
  return agentId ? getAgentById(agentId) : undefined;
}

export function resolveAgentDefinitionForOrchestrationRole(
  role: string | undefined,
): AgentDefinition | undefined {
  const agentId = mapAiMemberRoleToAgentId(role);
  return agentId ? getAgentById(agentId) : undefined;
}

export function resolveAgentIdFromRuntimeRole(agentRole: string | undefined): string | undefined {
  return mapAiMemberRoleToAgentId(agentRole) ?? ORCHESTRATION_ROLE_TO_AGENT_ID[String(agentRole ?? "").trim()];
}
