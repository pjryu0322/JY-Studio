import type { PlatformFlowId, PlatformMemberRole } from "@/lib/platform-orchestration/types";

export type RoleKnowledgePackBinding = Readonly<{
  readonly role: PlatformMemberRole;
  readonly knowledgePackId: string;
  readonly required?: boolean;
  readonly reason?: string;
}>;

export type ProjectKnowledgePackBinding = Readonly<{
  readonly projectId: string;
  readonly knowledgePackId: string;
  readonly appliesToRoles?: readonly PlatformMemberRole[];
  readonly reason?: string;
}>;

export type MemberKnowledgePackOverride = Readonly<{
  readonly memberId: string;
  readonly knowledgePackId: string;
  readonly reason?: string;
}>;

export type KnowledgePackSource = "role" | "project" | "member_override" | "flow";

export type ResolvedKnowledgeSource = Readonly<{
  readonly knowledgePackId: string;
  readonly source: KnowledgePackSource;
  readonly reason?: string;
}>;

export type ResolvedKnowledgeContext = Readonly<{
  readonly role: PlatformMemberRole;
  readonly memberId?: string;
  readonly knowledgePackIds: readonly string[];
  readonly requiredMissingKnowledgePackIds: readonly string[];
  readonly sources: readonly ResolvedKnowledgeSource[];
}>;

function normalizeKnowledgePackId(id: string): string {
  return String(id ?? "").trim();
}

function isValidKnowledgePackId(id: string): boolean {
  return normalizeKnowledgePackId(id).length > 0;
}

function pushUnique(
  packIds: string[],
  sources: ResolvedKnowledgeSource[],
  knowledgePackId: string,
  source: KnowledgePackSource,
  reason?: string,
): void {
  const normalized = normalizeKnowledgePackId(knowledgePackId);
  if (!isValidKnowledgePackId(normalized)) return;
  if (packIds.includes(normalized)) return;
  packIds.push(normalized);
  sources.push({ knowledgePackId: normalized, source, reason });
}

export function resolveKnowledgeContextForRole(input: {
  readonly role: PlatformMemberRole;
  readonly memberId?: string;
  readonly roleBindings: readonly RoleKnowledgePackBinding[];
  readonly projectBindings?: readonly ProjectKnowledgePackBinding[];
  readonly memberOverrides?: readonly MemberKnowledgePackOverride[];
  readonly flowId?: PlatformFlowId;
  readonly flowKnowledgePackIds?: readonly string[];
}): ResolvedKnowledgeContext {
  const packIds: string[] = [];
  const sources: ResolvedKnowledgeSource[] = [];
  const requiredMissingKnowledgePackIds: string[] = [];

  for (const binding of input.roleBindings) {
    if (binding.role !== input.role) continue;
    const id = normalizeKnowledgePackId(binding.knowledgePackId);
    if (binding.required && !isValidKnowledgePackId(id)) {
      requiredMissingKnowledgePackIds.push(id || `required:${binding.role}`);
      continue;
    }
    pushUnique(packIds, sources, id, "role", binding.reason);
  }

  for (const binding of input.projectBindings ?? []) {
    const applies =
      !binding.appliesToRoles?.length || binding.appliesToRoles.includes(input.role);
    if (!applies) continue;
    pushUnique(packIds, sources, binding.knowledgePackId, "project", binding.reason);
  }

  if (input.memberId) {
    for (const override of input.memberOverrides ?? []) {
      if (override.memberId !== input.memberId) continue;
      pushUnique(packIds, sources, override.knowledgePackId, "member_override", override.reason);
    }
  }

  for (const flowPackId of input.flowKnowledgePackIds ?? []) {
    pushUnique(packIds, sources, flowPackId, "flow", input.flowId ? `flow:${input.flowId}` : undefined);
  }

  return {
    role: input.role,
    memberId: input.memberId,
    knowledgePackIds: packIds,
    requiredMissingKnowledgePackIds,
    sources,
  };
}
