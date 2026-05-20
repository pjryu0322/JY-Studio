/**
 * Maps existing Workspace AI member catalog → Agent Definition ids (no runtime replacement).
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

/** DB / invite orchestration role strings → foundation agent id (partial). */
export const ORCHESTRATION_ROLE_TO_AGENT_ID: Readonly<Partial<Record<string, string>>> = {
  planner: "ai-planner",
  "service-designer": "ai-analyst",
  "domain-expert": "ai-architect",
  reviewer: "ai-reviewer",
  "security-reviewer": "ai-security",
  "scm-manager": "ai-scm",
  "orchestration-planner": "ai-planner",
  "orchestration-architect": "ai-architect",
  "orchestration-developer": "ai-developer",
};

export function resolveAgentDefinitionForWorkspaceMember(
  memberId: WorkspaceAiMemberId,
): AgentDefinition | undefined {
  const agentId = WORKSPACE_AI_MEMBER_TO_AGENT_ID[memberId];
  return agentId ? getAgentById(agentId) : undefined;
}

export function resolveAgentDefinitionForOrchestrationRole(role: string | undefined): AgentDefinition | undefined {
  const agentId = ORCHESTRATION_ROLE_TO_AGENT_ID[String(role ?? "").trim()];
  return agentId ? getAgentById(agentId) : undefined;
}
