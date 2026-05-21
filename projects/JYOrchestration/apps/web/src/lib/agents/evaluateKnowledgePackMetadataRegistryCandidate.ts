/**
 * Stage 5-B knowledge pack metadata registry candidate (read-only; no registry store/CRUD).
 */

import { evaluateRoleKnowledgeBindingClosure } from "@/lib/agents/evaluateRoleKnowledgeBindingClosure";
import type {
  KnowledgePackMetadataRegistryCandidateInput,
  KnowledgePackMetadataRegistryCandidateReport,
} from "@/lib/agents/knowledgePackMetadataRegistryCandidateTypes";
import {
  appendKnowledgePackMetadataRegistryCandidateFindings,
  buildKnowledgePackMetadataRegistryCandidateChecklist,
  parseKnowledgePackMetadataRegistryCandidateInput,
  REQUIRED_METADATA_FIELDS,
  resolveKnowledgePackMetadataRegistryCandidateDecision,
  validateMetadataCandidates,
} from "@/lib/agents/knowledgePackMetadataRegistryCandidateSupport";

export {
  REQUIRED_METADATA_FIELDS,
  resolveKnowledgePackMetadataRegistryCandidateDecision,
  validateMetadataCandidates,
} from "@/lib/agents/knowledgePackMetadataRegistryCandidateSupport";

export type { KnowledgePackMetadataRegistryCandidateDecisionInput } from "@/lib/agents/knowledgePackMetadataRegistryCandidateTypes";

/** Read-only Stage 5-B metadata registry candidate — not actual registry implementation. */
export function evaluateKnowledgePackMetadataRegistryCandidate(
  input?: KnowledgePackMetadataRegistryCandidateInput,
): KnowledgePackMetadataRegistryCandidateReport {
  const stage5AReport = evaluateRoleKnowledgeBindingClosure(input?.stage5AClosure);
  const { metadataCandidates } = parseKnowledgePackMetadataRegistryCandidateInput(input);
  const validation = validateMetadataCandidates(metadataCandidates);

  const decision = resolveKnowledgePackMetadataRegistryCandidateDecision({
    sourceStage5AClosureDecision: stage5AReport.decision,
    hasBlockedCandidate: validation.hasBlockedCandidate,
    hasMissingRequiredFields: validation.hasMissingRequiredFields,
  });

  const findings: import("@/lib/agents/knowledgePackMetadataRegistryCandidateTypes").KnowledgePackMetadataRegistryCandidateFinding[] =
    [];
  appendKnowledgePackMetadataRegistryCandidateFindings({
    findings,
    decision,
    sourceStage5AClosureDecision: stage5AReport.decision,
    validation,
  });

  return {
    mode: "read_only_knowledge_pack_metadata_registry_candidate",
    stage: "stage_5_b_candidate",
    decision,
    sourceStage5AClosureDecision: stage5AReport.decision,
    metadataCandidates,
    candidateCount: metadataCandidates.length,
    requiredMetadataFields: [...REQUIRED_METADATA_FIELDS],
    missingMetadataFieldFindings: validation.missingMetadataFieldFindings,
    registryCandidateOnly: true,
    actualRegistryImplementationAllowedInThisStep: false,
    actualKnowledgePackCrudAllowedInThisStep: false,
    actualDbWriteAllowedInThisStep: false,
    actualRagIndexingAllowedInThisStep: false,
    actualUiAllowedInThisStep: false,
    checklist: buildKnowledgePackMetadataRegistryCandidateChecklist({
      sourceStage5AClosureDecision: stage5AReport.decision,
      validation,
      candidateCount: metadataCandidates.length,
    }),
    findings,
  };
}
