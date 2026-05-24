import type { PlatformFlowId, PlatformMemberRole } from "@/lib/platform-orchestration/types";
import type { PlatformCapability } from "@/lib/platform-orchestration/roles";

export type ProjectAiMemberAssignment = Readonly<{
  readonly memberId: string;
  readonly role: PlatformMemberRole;
  readonly enabled: boolean;
  readonly displayName?: string;
  readonly capabilityOverrides?: readonly PlatformCapability[];
  readonly knowledgePackOverrides?: readonly string[];
}>;

export type ProjectAiTeamConfig = Readonly<{
  readonly projectId: string;
  readonly enabledRoles: readonly PlatformMemberRole[];
  readonly members: readonly ProjectAiMemberAssignment[];
}>;

export type FlowRoleRequirement = Readonly<{
  readonly flowId: PlatformFlowId;
  readonly requiredRoles: readonly PlatformMemberRole[];
  readonly recommendedRoles: readonly PlatformMemberRole[];
}>;

export type FlowRoleReadiness = Readonly<{
  readonly ready: boolean;
  readonly missingRequiredRoles: readonly PlatformMemberRole[];
  readonly missingRecommendedRoles: readonly PlatformMemberRole[];
}>;

export const FLOW_ROLE_REQUIREMENTS: readonly FlowRoleRequirement[] = [
  {
    flowId: "fast_plan_draft",
    requiredRoles: ["planner"],
    recommendedRoles: ["analyst", "architect", "designer"],
  },
  {
    flowId: "fast_plan_generation",
    requiredRoles: ["planner"],
    recommendedRoles: ["analyst", "architect", "designer"],
  },
  {
    flowId: "planning_slots",
    requiredRoles: ["planner"],
    recommendedRoles: ["analyst", "architect"],
  },
  {
    flowId: "service_flow",
    requiredRoles: ["analyst"],
    recommendedRoles: ["planner", "architect"],
  },
  {
    flowId: "feature_design",
    requiredRoles: ["architect"],
    recommendedRoles: ["planner", "designer"],
  },
  {
    flowId: "prototype_generation",
    requiredRoles: ["developer"],
    recommendedRoles: ["planner", "architect", "designer", "reviewer", "security"],
  },
  {
    flowId: "execution_runtime",
    requiredRoles: ["developer"],
    recommendedRoles: ["reviewer", "security", "scm"],
  },
  {
    flowId: "review_security_scm",
    requiredRoles: ["reviewer"],
    recommendedRoles: ["security", "scm"],
  },
] as const;

export function getFlowRoleRequirement(flowId: PlatformFlowId): FlowRoleRequirement | undefined {
  return FLOW_ROLE_REQUIREMENTS.find((r) => r.flowId === flowId);
}

export function hasRole(config: ProjectAiTeamConfig, role: PlatformMemberRole): boolean {
  if (!config.enabledRoles.includes(role)) return false;
  const roleMembers = config.members.filter((m) => m.role === role);
  if (roleMembers.length === 0) return true;
  return roleMembers.some((m) => m.enabled);
}

export function getEnabledMembersByRole(
  config: ProjectAiTeamConfig,
  role: PlatformMemberRole,
): readonly ProjectAiMemberAssignment[] {
  if (!config.enabledRoles.includes(role)) return [];
  return config.members.filter((m) => m.role === role && m.enabled);
}

function missingRoles(
  config: ProjectAiTeamConfig,
  roles: readonly PlatformMemberRole[],
): PlatformMemberRole[] {
  return roles.filter((role) => !hasRole(config, role));
}

export function evaluateFlowRoleReadiness(input: {
  readonly flowId: PlatformFlowId;
  readonly team: ProjectAiTeamConfig;
}): FlowRoleReadiness {
  const requirement = getFlowRoleRequirement(input.flowId);
  if (!requirement) {
    return {
      ready: true,
      missingRequiredRoles: [],
      missingRecommendedRoles: [],
    };
  }

  const missingRequiredRoles = missingRoles(input.team, requirement.requiredRoles);
  const missingRecommendedRoles = missingRoles(input.team, requirement.recommendedRoles);

  return {
    ready: missingRequiredRoles.length === 0,
    missingRequiredRoles,
    missingRecommendedRoles,
  };
}
