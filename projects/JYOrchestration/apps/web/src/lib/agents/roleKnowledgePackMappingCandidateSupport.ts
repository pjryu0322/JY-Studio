/**
 * Stage 5-C role knowledge pack mapping candidate support (read-only).
 */

import {
  DEFAULT_ROLE_KNOWLEDGE_BINDINGS,
  listDefaultRoleKnowledgeAgentTypes,
} from "@/lib/agents/defaultRoleKnowledgeBindings";
import type { KnowledgePackMetadataCandidate } from "@/lib/agents/knowledgePackMetadataRegistryCandidateTypes";
import type {
  RoleKnowledgePackMappingCandidate,
  RoleKnowledgePackMappingCandidateChecklistItem,
  RoleKnowledgePackMappingCandidateDecision,
  RoleKnowledgePackMappingCandidateDecisionInput,
  RoleKnowledgePackMappingCandidateFinding,
  RoleKnowledgePackMappingCandidateInput,
} from "@/lib/agents/roleKnowledgePackMappingCandidateTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: RoleKnowledgePackMappingCandidateFinding["severity"],
  code: string,
  message: string,
): RoleKnowledgePackMappingCandidateFinding {
  return { severity, code, message };
}

function mapChecklist(entries: readonly ChecklistEntry[]): RoleKnowledgePackMappingCandidateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function buildDefaultRoleKnowledgePackMappingCandidates(): readonly RoleKnowledgePackMappingCandidate[] {
  return listDefaultRoleKnowledgeAgentTypes().map((agentType) => {
    const bindings = DEFAULT_ROLE_KNOWLEDGE_BINDINGS[agentType] ?? [];
    const requiredKnowledgePackIds = bindings
      .filter((b) => b.required)
      .map((b) => b.knowledgePackId)
      .sort((a, b) => a.localeCompare(b));
    const optionalKnowledgePackIds = bindings
      .filter((b) => !b.required)
      .map((b) => b.knowledgePackId)
      .sort((a, b) => a.localeCompare(b));

    return {
      agentType,
      requiredKnowledgePackIds,
      optionalKnowledgePackIds,
      blockedKnowledgePackIds: [] as readonly string[],
      mappingReason: `Default role knowledge pack mapping candidate for ${agentType}`,
    };
  });
}

export function parseRoleKnowledgePackMappingCandidateInput(input?: RoleKnowledgePackMappingCandidateInput): {
  readonly agentTypes: readonly string[];
  readonly mappingCandidates: readonly RoleKnowledgePackMappingCandidate[];
} {
  const agentTypes =
    input?.agentTypes === undefined
      ? listDefaultRoleKnowledgeAgentTypes()
      : [...input.agentTypes].map((t) => t.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));

  const mappingCandidates =
    input?.mappingCandidates === undefined
      ? buildDefaultRoleKnowledgePackMappingCandidates()
      : [...input.mappingCandidates].sort((a, b) => a.agentType.localeCompare(b.agentType));

  return { agentTypes, mappingCandidates };
}

export type MappingValidation = {
  readonly hasUnknownAgent: boolean;
  readonly hasUnmappedAgent: boolean;
  readonly hasUnknownPackInMetadata: boolean;
  readonly unknownAgentTypes: readonly string[];
  readonly unmappedAgentTypes: readonly string[];
  readonly unknownKnowledgePackIdsInMappings: readonly string[];
  readonly duplicateKnowledgePackIdsInMappings: readonly string[];
};

export function validateRoleKnowledgePackMappings(input: {
  readonly agentTypes: readonly string[];
  readonly mappingCandidates: readonly RoleKnowledgePackMappingCandidate[];
  readonly metadataPackIds: ReadonlySet<string>;
}): MappingValidation {
  const knownAgents = new Set(listDefaultRoleKnowledgeAgentTypes());
  const unknownAgentTypes: string[] = [];
  const unmappedAgentTypes: string[] = [];
  const unknownPackIds = new Set<string>();
  const duplicatePackIds = new Set<string>();

  const mappingByAgent = new Map(input.mappingCandidates.map((m) => [m.agentType, m]));

  for (const agentType of input.agentTypes) {
    if (!knownAgents.has(agentType)) {
      unknownAgentTypes.push(agentType);
      continue;
    }

    const mapping = mappingByAgent.get(agentType);
    if (!mapping) {
      unmappedAgentTypes.push(agentType);
      continue;
    }

    const hasMapping =
      mapping.requiredKnowledgePackIds.length > 0 || mapping.optionalKnowledgePackIds.length > 0;
    if (!hasMapping) {
      unmappedAgentTypes.push(agentType);
    }

    const allPackIds = [
      ...mapping.requiredKnowledgePackIds,
      ...mapping.optionalKnowledgePackIds,
      ...mapping.blockedKnowledgePackIds,
    ];
    const seen = new Set<string>();
    for (const packId of allPackIds) {
      if (!input.metadataPackIds.has(packId)) {
        unknownPackIds.add(packId);
      }
      if (seen.has(packId)) {
        duplicatePackIds.add(packId);
      }
      seen.add(packId);
    }
  }

  return {
    hasUnknownAgent: unknownAgentTypes.length > 0,
    hasUnmappedAgent: unmappedAgentTypes.length > 0,
    hasUnknownPackInMetadata: unknownPackIds.size > 0,
    unknownAgentTypes: unknownAgentTypes.sort((a, b) => a.localeCompare(b)),
    unmappedAgentTypes: unmappedAgentTypes.sort((a, b) => a.localeCompare(b)),
    unknownKnowledgePackIdsInMappings: [...unknownPackIds].sort((a, b) => a.localeCompare(b)),
    duplicateKnowledgePackIdsInMappings: [...duplicatePackIds].sort((a, b) => a.localeCompare(b)),
  };
}

export function resolveRoleKnowledgePackMappingCandidateDecision(
  input: RoleKnowledgePackMappingCandidateDecisionInput,
): RoleKnowledgePackMappingCandidateDecision {
  if (input.sourceStage5BDecision === "blocked" || input.hasUnknownAgent) {
    return "blocked";
  }

  if (input.sourceStage5BDecision === "defer" || input.hasUnknownPackInMetadata || input.hasUnmappedAgent) {
    return "defer";
  }

  return "ready_for_mapping_design";
}

export function buildRoleKnowledgePackMappingCandidateChecklist(input: {
  readonly sourceStage5BDecision: RoleKnowledgePackMappingCandidateDecisionInput["sourceStage5BDecision"];
  readonly validation: MappingValidation;
  readonly mappedAgentCount: number;
}): RoleKnowledgePackMappingCandidateChecklistItem[] {
  return mapChecklist([
    {
      item: "source Stage 5-B not blocked",
      satisfied: input.sourceStage5BDecision !== "blocked",
      detail: `sourceStage5BDecision=${input.sourceStage5BDecision}`,
    },
    {
      item: "source Stage 5-B ready for mapping design",
      satisfied: input.sourceStage5BDecision === "ready_for_metadata_registry_design",
      detail: `sourceStage5BDecision=${input.sourceStage5BDecision}`,
    },
    {
      item: "no unknown agent types",
      satisfied: !input.validation.hasUnknownAgent,
      detail: `unknownAgentTypes=${input.validation.unknownAgentTypes.join(",") || "none"}`,
    },
    {
      item: "all agent types mapped",
      satisfied: input.validation.unmappedAgentTypes.length === 0,
      detail: `unmappedAgentTypes=${input.validation.unmappedAgentTypes.join(",") || "none"}`,
    },
    {
      item: "mapping pack ids in metadata candidates",
      satisfied: input.validation.unknownKnowledgePackIdsInMappings.length === 0,
      detail: `unknownPackIds=${input.validation.unknownKnowledgePackIdsInMappings.join(",") || "none"}`,
    },
    {
      item: "mapping candidate only",
      satisfied: true,
      detail: "mappingCandidateOnly=true",
    },
    {
      item: "mapped agent count positive",
      satisfied: input.mappedAgentCount > 0,
      detail: `mappedAgentCount=${input.mappedAgentCount}`,
    },
  ]);
}

export function appendRoleKnowledgePackMappingCandidateFindings(input: {
  readonly findings: RoleKnowledgePackMappingCandidateFinding[];
  readonly decision: RoleKnowledgePackMappingCandidateDecision;
  readonly sourceStage5BDecision: RoleKnowledgePackMappingCandidateDecisionInput["sourceStage5BDecision"];
  readonly validation: MappingValidation;
}): void {
  const { findings, decision, sourceStage5BDecision, validation } = input;

  findings.push(finding("info", "stage5_c_mapping_candidate_evaluator_created", "Stage 5-C mapping candidate evaluator created"));
  findings.push(finding("info", "stage5_c_mapping_candidate_only", "Stage 5-C is mapping candidate only"));
  findings.push(finding("info", "stage5_c_no_runtime_wire", "Stage 5-C does not wire runtime binding"));

  if (sourceStage5BDecision === "blocked") {
    findings.push(finding("blocking", "source_stage5_b_blocked", "Source Stage 5-B decision is blocked"));
    findings.push(finding("blocking", "stage5_c_mapping_blocked", "Stage 5-C mapping candidate is blocked"));
    return;
  }

  if (validation.hasUnknownAgent) {
    findings.push(finding("blocking", "mapping_unknown_agent_type", "Mapping references unknown agent type"));
    findings.push(finding("blocking", "stage5_c_mapping_blocked", "Stage 5-C mapping candidate is blocked"));
    return;
  }

  if (decision === "defer") {
    if (sourceStage5BDecision === "defer") {
      findings.push(finding("warning", "source_stage5_b_deferred", "Source Stage 5-B decision defers"));
    }
    if (validation.hasUnknownPackInMetadata) {
      findings.push(finding("warning", "mapping_unknown_knowledge_pack_id", "Mapping references pack id not in metadata candidates"));
    }
    if (validation.hasUnmappedAgent) {
      findings.push(finding("warning", "mapping_agent_unmapped", "One or more agent types lack required/optional mapping"));
    }
    findings.push(finding("warning", "stage5_c_mapping_deferred", "Stage 5-C mapping candidate defers"));
    return;
  }

  findings.push(finding("info", "stage5_c_mapping_ready", "Stage 5-C mapping candidate is ready for design"));
}

export function metadataPackIdSet(candidates: readonly KnowledgePackMetadataCandidate[]): ReadonlySet<string> {
  return new Set(candidates.map((c) => c.knowledgePackId));
}
