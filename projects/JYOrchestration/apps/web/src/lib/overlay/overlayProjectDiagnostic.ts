import type { SingleChatSelectedAgentWire } from "@/lib/requirements/singleChatAgentContext";
import type { OverlayRuntimePolicyHintsWire } from "@/lib/overlay/overlayPolicy";
import { buildOverlayRuntimePolicyHintsWire } from "@/lib/overlay/overlayPolicy";
import { resolveOverlayIdentityFromAiMember } from "@/lib/overlay/overlayIdentityFromWorkspace";

export type ProjectOverlayAgentDiagnosticRow = Readonly<{
  source: SingleChatSelectedAgentWire["source"];
  catalogKey: string | null;
  displayName: string;
  aiOrchestrationRole: string | null;
  overlayRoleKey: string | null;
  provider: string | null;
  capabilities: readonly string[];
  knowledgeScopes: readonly string[];
  overlayPolicyHints: OverlayRuntimePolicyHintsWire;
}>;

export type ProjectOverlayDiagnosticWire = Readonly<{
  projectId: string;
  selectedAgentCount: number;
  resolvedAgents: readonly ProjectOverlayAgentDiagnosticRow[];
  unresolvedAgents: readonly ProjectOverlayAgentDiagnosticRow[];
  providerCounts: Readonly<Record<string, number>>;
  capabilityCounts: Readonly<Record<string, number>>;
  knowledgeScopeCounts: Readonly<Record<string, number>>;
}>;

function bump(map: Record<string, number>, key: string, delta = 1): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + delta;
}

/**
 * 서비스 기획 통합 `selectedAgents` 스냅샷을 Overlay 진단용 와이어로 변환한다(읽기 전용).
 */
export function buildProjectOverlayDiagnosticFromSelectedAgents(
  projectId: string,
  agents: readonly SingleChatSelectedAgentWire[]
): ProjectOverlayDiagnosticWire {
  const pid = projectId.trim();
  const providerCounts: Record<string, number> = {};
  const capabilityCounts: Record<string, number> = {};
  const knowledgeScopeCounts: Record<string, number> = {};

  const resolvedAgents: ProjectOverlayAgentDiagnosticRow[] = [];
  const unresolvedAgents: ProjectOverlayAgentDiagnosticRow[] = [];

  for (const a of agents) {
    const id = resolveOverlayIdentityFromAiMember({
      catalogKey: a.catalogKey ?? null,
      aiOrchestrationRole: a.aiOrchestrationRole,
    });
    const policyKey = id?.roleKey ?? a.aiOrchestrationRole ?? a.catalogKey ?? null;
    const overlayPolicyHints = buildOverlayRuntimePolicyHintsWire(policyKey);
    const row: ProjectOverlayAgentDiagnosticRow = {
      source: a.source,
      catalogKey: a.catalogKey ?? null,
      displayName: a.displayName,
      aiOrchestrationRole: a.aiOrchestrationRole ?? null,
      overlayRoleKey: id?.roleKey ?? null,
      provider: id?.provider ?? null,
      capabilities: id ? [...id.capabilities] : [],
      knowledgeScopes: id ? [...id.knowledgeScopes] : [],
      overlayPolicyHints,
    };
    if (id) {
      resolvedAgents.push(row);
      bump(providerCounts, id.provider);
      for (const c of id.capabilities) bump(capabilityCounts, c);
      for (const ks of id.knowledgeScopes) bump(knowledgeScopeCounts, ks);
    } else {
      unresolvedAgents.push(row);
    }
  }

  return {
    projectId: pid,
    selectedAgentCount: agents.length,
    resolvedAgents,
    unresolvedAgents,
    providerCounts,
    capabilityCounts,
    knowledgeScopeCounts,
  };
}
