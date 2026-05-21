/**
 * Stage 5-C role knowledge pack mapping candidate (read-only; no runtime wire).
 */

import { evaluateKnowledgePackMetadataRegistryCandidate } from "@/lib/agents/evaluateKnowledgePackMetadataRegistryCandidate";
import { toMetadataRegistryEvaluatorInput } from "@/lib/agents/stage5KnowledgeFoundationInput";
import type {
  RoleKnowledgePackMappingCandidateFinding,
  RoleKnowledgePackMappingCandidateInput,
  RoleKnowledgePackMappingCandidateReport,
} from "@/lib/agents/roleKnowledgePackMappingCandidateTypes";
import {
  appendRoleKnowledgePackMappingCandidateFindings,
  buildRoleKnowledgePackMappingCandidateChecklist,
  metadataPackIdSet,
  parseRoleKnowledgePackMappingCandidateInput,
  resolveRoleKnowledgePackMappingCandidateDecision,
  validateRoleKnowledgePackMappings,
} from "@/lib/agents/roleKnowledgePackMappingCandidateSupport";

export {
  buildDefaultRoleKnowledgePackMappingCandidates,
  resolveRoleKnowledgePackMappingCandidateDecision,
  validateRoleKnowledgePackMappings,
} from "@/lib/agents/roleKnowledgePackMappingCandidateSupport";

export type { RoleKnowledgePackMappingCandidateDecisionInput } from "@/lib/agents/roleKnowledgePackMappingCandidateTypes";

/** Read-only Stage 5-C mapping candidate — not runtime binding wire. */
export function evaluateRoleKnowledgePackMappingCandidate(
  input?: RoleKnowledgePackMappingCandidateInput,
): RoleKnowledgePackMappingCandidateReport {
  const stage5BReport = evaluateKnowledgePackMetadataRegistryCandidate(toMetadataRegistryEvaluatorInput(input));
  const { agentTypes, mappingCandidates } = parseRoleKnowledgePackMappingCandidateInput(input);
  const validation = validateRoleKnowledgePackMappings({
    agentTypes,
    mappingCandidates,
    metadataPackIds: metadataPackIdSet(stage5BReport.metadataCandidates),
  });

  const mappedAgentCount = mappingCandidates.filter(
    (m) => m.requiredKnowledgePackIds.length > 0 || m.optionalKnowledgePackIds.length > 0,
  ).length;

  const decision = resolveRoleKnowledgePackMappingCandidateDecision({
    sourceStage5BDecision: stage5BReport.decision,
    hasUnknownAgent: validation.hasUnknownAgent,
    hasUnmappedAgent: validation.hasUnmappedAgent,
    hasUnknownPackInMetadata: validation.hasUnknownPackInMetadata,
  });

  const findings: RoleKnowledgePackMappingCandidateFinding[] = [];
  appendRoleKnowledgePackMappingCandidateFindings({
    findings,
    decision,
    sourceStage5BDecision: stage5BReport.decision,
    validation,
  });

  return {
    mode: "read_only_role_knowledge_pack_mapping_candidate",
    stage: "stage_5_c_candidate",
    decision,
    sourceStage5BDecision: stage5BReport.decision,
    mappingCandidates,
    mappingCandidateCount: mappingCandidates.length,
    mappedAgentCount,
    unmappedAgentTypes: validation.unmappedAgentTypes,
    unknownKnowledgePackIdsInMappings: validation.unknownKnowledgePackIdsInMappings,
    duplicateKnowledgePackIdsInMappings: validation.duplicateKnowledgePackIdsInMappings,
    mappingCandidateOnly: true,
    actualRoleKnowledgePackMappingWireAllowedInThisStep: false,
    actualPromptInjectionAllowedInThisStep: false,
    actualRuntimeBindingAllowedInThisStep: false,
    checklist: buildRoleKnowledgePackMappingCandidateChecklist({
      sourceStage5BDecision: stage5BReport.decision,
      validation,
      mappedAgentCount,
    }),
    findings,
  };
}
