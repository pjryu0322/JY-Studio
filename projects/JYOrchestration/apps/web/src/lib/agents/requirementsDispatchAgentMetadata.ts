/**
 * Stage 2-1 — Requirements dispatch agent metadata (optional, not persisted by default).
 */

import { validateAgentCapabilityBinding } from "@/lib/agents/agentCapabilityBinding";
import { getAgentById } from "@/lib/agents/agentRegistry";
import {
  getDefaultAgentForStage,
  mapAiMemberRoleToAgentId,
  mapRequirementIntentToPrimaryAgentId,
  mapWorkspaceAiMemberToAgentId,
  resolveAgentIdFromRuntimeRole,
} from "@/lib/agents/aiMemberAgentBridge";
import type { AgentRuntimeEventContext, AgentTimelineMetadata } from "@/lib/agents/agentRuntimeEventContract";
import { agentReplayContractFromFoundation } from "@/lib/agents/orchestrationRuntimeBridge";

export type RequirementsAgentRuntimeMetadata = Readonly<{
  readonly agentId?: string;
  readonly capabilityId?: string;
  readonly lastAgentEvent?: AgentRuntimeEventContext;
  readonly timelineMetadata?: AgentTimelineMetadata;
  readonly replaySnapshot?: ReturnType<typeof agentReplayContractFromFoundation>;
  readonly warnings?: readonly string[];
  readonly agentResolutionReason?: string;
  readonly capabilityResolutionReason?: string;
}>;

export type ResolveDispatchAgentSource =
  | "runtimeRole"
  | "aiMemberRole"
  | "intent"
  | "stage"
  | "workspaceMember"
  | "none";

export interface ResolveDispatchAgentInput {
  readonly intentToken?: string;
  readonly suggestedActionId?: string | null;
  readonly stage?: string;
  readonly aiMemberRole?: string;
  readonly runtimeRole?: string;
  readonly workspaceAiMemberId?: string;
}

export interface ResolveDispatchAgentResult {
  readonly agentId?: string;
  readonly reason: string;
  readonly source: ResolveDispatchAgentSource;
  readonly warnings?: readonly string[];
}

export type ResolveDispatchCapabilitySource = "intent" | "stage" | "action" | "agentDefault" | "none";

export interface ResolveDispatchCapabilityInput {
  readonly agentId?: string;
  readonly intentToken?: string;
  readonly stage?: string;
  readonly suggestedActionId?: string | null;
}

export interface ResolveDispatchCapabilityResult {
  readonly capabilityId?: string;
  readonly reason: string;
  readonly source: ResolveDispatchCapabilitySource;
  readonly validBinding: boolean;
  readonly warnings?: readonly string[];
}

export interface BuildRequirementsAgentMetadataInput {
  readonly projectId?: string;
  readonly conversationId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly intentToken?: string;
  readonly suggestedActionId?: string | null;
  readonly stage?: string;
  readonly aiMemberRole?: string;
  readonly runtimeRole?: string;
  readonly workspaceAiMemberId?: string;
}

const INTENT_TOKEN_TO_CAPABILITY: Readonly<Record<string, string>> = {
  ideation: "project.idea.structure",
  planning: "project.idea.structure",
  actor_flow: "service.flow.analysis",
  service_flow: "service.flow.analysis",
  feature_scope: "feature.scope.design",
  architecture: "feature.scope.design",
  uiux: "uiux.prototype.design",
  prototype_design: "uiux.prototype.design",
  prototype_build: "cursor.implementation.plan",
  implementation: "cursor.implementation.plan",
  review: "source.review",
  validation: "source.review",
  security: "security.review",
  security_review: "security.review",
};

const STAGE_TO_CAPABILITY: Readonly<Record<string, string>> = {
  IDEATION: "project.idea.structure",
  SERVICE_FLOW: "service.flow.analysis",
  SERVICE_FLOW_REVIEW: "service.flow.analysis",
  FEATURE_DETAIL: "feature.scope.design",
  SCREEN_DEFINE: "uiux.prototype.design",
  API_DEFINE: "feature.scope.design",
  PROTOTYPE: "cursor.implementation.plan",
  REVIEW: "source.review",
};

const ACTION_TO_CAPABILITY: Readonly<Partial<Record<string, string>>> = {
  EDIT_FEATURES: "feature.scope.design",
  DEFINE_SCREEN: "uiux.prototype.design",
  DEFINE_API: "feature.scope.design",
  GENERATE_DOCUMENT: "cursor.implementation.plan",
  REVIEW_FLOW: "project.idea.structure",
};

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function resolveDispatchAgent(input: ResolveDispatchAgentInput): ResolveDispatchAgentResult {
  const warnings: string[] = [];

  const fromRuntime = resolveAgentIdFromRuntimeRole(input.runtimeRole);
  if (fromRuntime) {
    return { agentId: fromRuntime, reason: `runtimeRole:${input.runtimeRole}`, source: "runtimeRole" };
  }

  const fromAiMember = mapAiMemberRoleToAgentId(input.aiMemberRole);
  if (fromAiMember) {
    return { agentId: fromAiMember, reason: `aiMemberRole:${input.aiMemberRole}`, source: "aiMemberRole" };
  }

  const ws = String(input.workspaceAiMemberId ?? "").trim();
  if (ws) {
    const fromWs = mapWorkspaceAiMemberToAgentId(ws);
    if (fromWs) {
      return { agentId: fromWs, reason: `workspaceMember:${ws}`, source: "workspaceMember" };
    }
  }

  const fromIntent = mapRequirementIntentToPrimaryAgentId({
    suggestedActionId: input.suggestedActionId,
    authoritativeStage: input.stage,
    routerMode: input.intentToken,
  });
  if (fromIntent) {
    return { agentId: fromIntent, reason: "intent:actionOrStage", source: "intent" };
  }

  const token = normalizeToken(input.intentToken);
  if (token) {
    const fromToken = getDefaultAgentForStage(token);
    if (fromToken) {
      return { agentId: fromToken, reason: `intentToken:${token}`, source: "intent" };
    }
    warnings.push(`unknown_intent_token:${token}`);
  }

  const stage = String(input.stage ?? "").trim();
  if (stage) {
    const fromStage = getDefaultAgentForStage(stage);
    if (fromStage) {
      return { agentId: fromStage, reason: `stage:${stage}`, source: "stage", warnings };
    }
    warnings.push(`unknown_stage:${stage}`);
  }

  return {
    reason: "no_agent_match",
    source: "none",
    ...(warnings.length ? { warnings } : {}),
  };
}

export function resolveDispatchCapability(
  input: ResolveDispatchCapabilityInput,
): ResolveDispatchCapabilityResult {
  const warnings: string[] = [];
  const agentId = input.agentId;

  const action = String(input.suggestedActionId ?? "").trim();
  if (action && ACTION_TO_CAPABILITY[action]) {
    const capabilityId = ACTION_TO_CAPABILITY[action]!;
    const validBinding = agentId ? validateAgentCapabilityBinding(agentId, capabilityId) : false;
    if (!validBinding && agentId) {
      warnings.push(`binding_invalid:${agentId}+${capabilityId}`);
    }
    return {
      capabilityId: validBinding || !agentId ? capabilityId : undefined,
      reason: `action:${action}`,
      source: "action",
      validBinding: agentId ? validBinding : false,
      ...(warnings.length ? { warnings } : {}),
    };
  }

  const token = normalizeToken(input.intentToken);
  if (token && INTENT_TOKEN_TO_CAPABILITY[token]) {
    const capabilityId = INTENT_TOKEN_TO_CAPABILITY[token]!;
    const validBinding = agentId ? validateAgentCapabilityBinding(agentId, capabilityId) : false;
    if (!validBinding && agentId) warnings.push(`binding_invalid:${agentId}+${capabilityId}`);
    return {
      capabilityId: validBinding || !agentId ? capabilityId : undefined,
      reason: `intentToken:${token}`,
      source: "intent",
      validBinding: agentId ? validBinding : false,
      ...(warnings.length ? { warnings } : {}),
    };
  }

  const stage = String(input.stage ?? "").trim();
  if (stage && STAGE_TO_CAPABILITY[stage]) {
    const capabilityId = STAGE_TO_CAPABILITY[stage]!;
    const validBinding = agentId ? validateAgentCapabilityBinding(agentId, capabilityId) : false;
    if (!validBinding && agentId) warnings.push(`binding_invalid:${agentId}+${capabilityId}`);
    return {
      capabilityId: validBinding || !agentId ? capabilityId : undefined,
      reason: `stage:${stage}`,
      source: "stage",
      validBinding: agentId ? validBinding : false,
      ...(warnings.length ? { warnings } : {}),
    };
  }

  if (agentId) {
    const agent = getAgentById(agentId);
    const capabilityId = agent?.defaultCapabilities[0];
    if (capabilityId) {
      const validBinding = validateAgentCapabilityBinding(agentId, capabilityId);
      if (!validBinding) warnings.push(`binding_invalid:${agentId}+${capabilityId}`);
      return {
        capabilityId: validBinding ? capabilityId : undefined,
        reason: `agentDefault:${capabilityId}`,
        source: "agentDefault",
        validBinding,
        ...(warnings.length ? { warnings } : {}),
      };
    }
  }

  return {
    reason: "no_capability_match",
    source: "none",
    validBinding: false,
    ...(warnings.length ? { warnings } : {}),
  };
}

function buildAgentRuntimeEventContextOptional(input: {
  readonly agentId?: string;
  readonly capabilityId?: string;
  readonly projectId?: string;
  readonly conversationId?: string;
  readonly runId?: string;
  readonly taskId?: string;
}): AgentRuntimeEventContext | undefined {
  if (!input.agentId) return undefined;
  return {
    agentId: input.agentId,
    source: "requirements",
    ...(input.capabilityId ? { capabilityId: input.capabilityId } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.taskId ? { taskId: input.taskId } : {}),
  };
}

/** Safe wrapper — never throws; returns undefined on internal failure. */
export function buildRequirementsAgentMetadata(
  input: BuildRequirementsAgentMetadataInput,
): RequirementsAgentRuntimeMetadata | undefined {
  try {
    const agentResolution = resolveDispatchAgent({
      intentToken: input.intentToken,
      suggestedActionId: input.suggestedActionId,
      stage: input.stage,
      aiMemberRole: input.aiMemberRole,
      runtimeRole: input.runtimeRole,
      workspaceAiMemberId: input.workspaceAiMemberId,
    });

    const capabilityResolution = resolveDispatchCapability({
      agentId: agentResolution.agentId,
      intentToken: input.intentToken,
      stage: input.stage,
      suggestedActionId: input.suggestedActionId,
    });

    const warnings = [
      ...(agentResolution.warnings ?? []),
      ...(capabilityResolution.warnings ?? []),
    ];

    const lastAgentEvent = buildAgentRuntimeEventContextOptional({
      agentId: agentResolution.agentId,
      capabilityId: capabilityResolution.capabilityId,
      projectId: input.projectId,
      conversationId: input.conversationId,
      runId: input.runId,
      taskId: input.taskId,
    });

    const agent = agentResolution.agentId ? getAgentById(agentResolution.agentId) : undefined;

    const timelineMetadata: AgentTimelineMetadata | undefined =
      agentResolution.agentId ?
        {
          agentId: agentResolution.agentId,
          ...(capabilityResolution.capabilityId ? { capabilityId: capabilityResolution.capabilityId } : {}),
          ...(agent ? { agentType: agent.type, runtimeMode: agent.runtimeMode } : {}),
        }
      : undefined;

    const replaySnapshot =
      agentResolution.agentId ?
        agentReplayContractFromFoundation({
          agentId: agentResolution.agentId,
          capabilityId: capabilityResolution.capabilityId,
          inputContextKeys: [
            input.intentToken,
            input.stage,
            input.suggestedActionId,
          ].filter(Boolean) as string[],
          outputType: capabilityResolution.capabilityId,
        })
      : undefined;

    return {
      ...(agentResolution.agentId ? { agentId: agentResolution.agentId } : {}),
      ...(capabilityResolution.capabilityId ? { capabilityId: capabilityResolution.capabilityId } : {}),
      ...(lastAgentEvent ? { lastAgentEvent } : {}),
      ...(timelineMetadata ? { timelineMetadata } : {}),
      ...(replaySnapshot ? { replaySnapshot } : {}),
      agentResolutionReason: agentResolution.reason,
      capabilityResolutionReason: capabilityResolution.reason,
      ...(warnings.length ? { warnings } : {}),
    };
  } catch {
    return undefined;
  }
}

export function formatAgentMetadataForTimeline(meta: RequirementsAgentRuntimeMetadata | undefined): string {
  if (!meta?.agentId) return "";
  const parts = [
    `agentId:${meta.agentId}`,
    meta.capabilityId ? `capabilityId:${meta.capabilityId}` : "",
    meta.agentResolutionReason ? `agentResolve:${meta.agentResolutionReason}` : "",
    meta.capabilityResolutionReason ? `capResolve:${meta.capabilityResolutionReason}` : "",
  ].filter(Boolean);
  return parts.join(" ");
}
