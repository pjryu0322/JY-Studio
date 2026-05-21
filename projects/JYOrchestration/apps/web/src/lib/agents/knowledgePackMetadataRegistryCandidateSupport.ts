/**
 * Stage 5-B metadata registry candidate support (read-only).
 */

import { buildDefaultKnowledgePackMetadataCandidates } from "@/lib/agents/defaultKnowledgePackMetadataCandidates";
import type {
  KnowledgePackMetadataCandidate,
  KnowledgePackMetadataCategory,
  KnowledgePackMetadataRegistryCandidateChecklistItem,
  KnowledgePackMetadataRegistryCandidateDecision,
  KnowledgePackMetadataRegistryCandidateDecisionInput,
  KnowledgePackMetadataRegistryCandidateFinding,
  KnowledgePackMetadataRegistryCandidateInput,
  KnowledgePackMetadataSourceType,
  KnowledgePackMetadataStatus,
} from "@/lib/agents/knowledgePackMetadataRegistryCandidateTypes";

export const REQUIRED_METADATA_FIELDS = [
  "knowledgePackId",
  "title",
  "version",
  "category",
  "sourceType",
  "status",
  "summary",
  "intendedAgentTypes",
  "requiredForRoles",
  "optionalForRoles",
] as const;

const VALID_CATEGORIES: readonly KnowledgePackMetadataCategory[] = [
  "platform",
  "development",
  "security",
  "review",
  "domain",
  "project",
  "external_product",
];

const VALID_SOURCE_TYPES: readonly KnowledgePackMetadataSourceType[] = [
  "manual",
  "document",
  "policy",
  "standard",
  "guide",
  "external_reference",
  "unknown",
];

const VALID_STATUSES: readonly KnowledgePackMetadataStatus[] = ["candidate", "needs_review", "blocked"];

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: KnowledgePackMetadataRegistryCandidateFinding["severity"],
  code: string,
  message: string,
): KnowledgePackMetadataRegistryCandidateFinding {
  return { severity, code, message };
}

function mapChecklist(entries: readonly ChecklistEntry[]): KnowledgePackMetadataRegistryCandidateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function parseKnowledgePackMetadataRegistryCandidateInput(
  input?: KnowledgePackMetadataRegistryCandidateInput,
): { readonly metadataCandidates: readonly KnowledgePackMetadataCandidate[] } {
  const candidates = input?.metadataCandidates ?? buildDefaultKnowledgePackMetadataCandidates();
  return {
    metadataCandidates: [...candidates].sort((a, b) => a.knowledgePackId.localeCompare(b.knowledgePackId)),
  };
}

function isNonBlank(value: string): boolean {
  return value.trim().length > 0;
}

function fieldPresent(candidate: KnowledgePackMetadataCandidate, field: (typeof REQUIRED_METADATA_FIELDS)[number]): boolean {
  switch (field) {
    case "knowledgePackId":
      return isNonBlank(candidate.knowledgePackId);
    case "title":
      return isNonBlank(candidate.title);
    case "version":
      return isNonBlank(candidate.version);
    case "category":
      return VALID_CATEGORIES.includes(candidate.category);
    case "sourceType":
      return VALID_SOURCE_TYPES.includes(candidate.sourceType);
    case "status":
      return VALID_STATUSES.includes(candidate.status);
    case "summary":
      return isNonBlank(candidate.summary);
    case "intendedAgentTypes":
      return candidate.intendedAgentTypes.length > 0;
    case "requiredForRoles":
      return Array.isArray(candidate.requiredForRoles);
    case "optionalForRoles":
      return Array.isArray(candidate.optionalForRoles);
    default:
      return false;
  }
}

export type MetadataCandidateValidation = {
  readonly hasBlockedCandidate: boolean;
  readonly hasMissingRequiredFields: boolean;
  readonly missingMetadataFieldFindings: readonly KnowledgePackMetadataRegistryCandidateFinding[];
  readonly blankIds: readonly string[];
  readonly invalidCategoryIds: readonly string[];
  readonly invalidStatusIds: readonly string[];
};

export function validateMetadataCandidates(
  candidates: readonly KnowledgePackMetadataCandidate[],
): MetadataCandidateValidation {
  const missingMetadataFieldFindings: KnowledgePackMetadataRegistryCandidateFinding[] = [];
  const blankIds: string[] = [];
  const invalidCategoryIds: string[] = [];
  const invalidStatusIds: string[] = [];
  let hasMissingRequiredFields = false;

  for (const candidate of candidates) {
    const packId = candidate.knowledgePackId.trim();

    if (!isNonBlank(candidate.knowledgePackId)) {
      blankIds.push(candidate.knowledgePackId || "(blank)");
    }

    if (!VALID_CATEGORIES.includes(candidate.category)) {
      invalidCategoryIds.push(packId || "(blank)");
    }

    if (!VALID_STATUSES.includes(candidate.status)) {
      invalidStatusIds.push(packId || "(blank)");
    }

    for (const field of REQUIRED_METADATA_FIELDS) {
      if (!fieldPresent(candidate, field)) {
        hasMissingRequiredFields = true;
        missingMetadataFieldFindings.push(
          finding(
            "warning",
            "metadata_required_field_missing",
            `Candidate ${packId || "(blank)"} missing required field: ${field}`,
          ),
        );
      }
    }
  }

  const hasBlockedCandidate =
    blankIds.length > 0 || invalidCategoryIds.length > 0 || invalidStatusIds.length > 0;

  return {
    hasBlockedCandidate,
    hasMissingRequiredFields,
    missingMetadataFieldFindings: missingMetadataFieldFindings.sort((a, b) =>
      a.message.localeCompare(b.message),
    ),
    blankIds: [...blankIds].sort((a, b) => a.localeCompare(b)),
    invalidCategoryIds: [...invalidCategoryIds].sort((a, b) => a.localeCompare(b)),
    invalidStatusIds: [...invalidStatusIds].sort((a, b) => a.localeCompare(b)),
  };
}

/** Pure decision helper for Stage 5-B metadata registry candidate. */
export function resolveKnowledgePackMetadataRegistryCandidateDecision(
  input: KnowledgePackMetadataRegistryCandidateDecisionInput,
): KnowledgePackMetadataRegistryCandidateDecision {
  if (input.sourceStage5AClosureDecision === "blocked" || input.hasBlockedCandidate) {
    return "blocked";
  }

  if (input.sourceStage5AClosureDecision === "defer" || input.hasMissingRequiredFields) {
    return "defer";
  }

  return "ready_for_metadata_registry_design";
}

export function buildKnowledgePackMetadataRegistryCandidateChecklist(input: {
  readonly sourceStage5AClosureDecision: KnowledgePackMetadataRegistryCandidateDecisionInput["sourceStage5AClosureDecision"];
  readonly validation: MetadataCandidateValidation;
  readonly candidateCount: number;
}): KnowledgePackMetadataRegistryCandidateChecklistItem[] {
  return mapChecklist([
    {
      item: "source Stage 5-A closure not blocked",
      satisfied: input.sourceStage5AClosureDecision !== "blocked",
      detail: `sourceStage5AClosureDecision=${input.sourceStage5AClosureDecision}`,
    },
    {
      item: "source Stage 5-A closure ready",
      satisfied: input.sourceStage5AClosureDecision === "stage5_a_closure_ready",
      detail: `sourceStage5AClosureDecision=${input.sourceStage5AClosureDecision}`,
    },
    {
      item: "no blank knowledge pack ids",
      satisfied: input.validation.blankIds.length === 0,
      detail: `blankIds=${input.validation.blankIds.join(",") || "none"}`,
    },
    {
      item: "all metadata categories valid",
      satisfied: input.validation.invalidCategoryIds.length === 0,
      detail: `invalidCategoryIds=${input.validation.invalidCategoryIds.join(",") || "none"}`,
    },
    {
      item: "all metadata statuses valid",
      satisfied: input.validation.invalidStatusIds.length === 0,
      detail: `invalidStatusIds=${input.validation.invalidStatusIds.join(",") || "none"}`,
    },
    {
      item: "required metadata fields present",
      satisfied: !input.validation.hasMissingRequiredFields,
      detail: `hasMissingRequiredFields=${input.validation.hasMissingRequiredFields}`,
    },
    {
      item: "registry candidate only",
      satisfied: true,
      detail: "registryCandidateOnly=true",
    },
    {
      item: "at least one metadata candidate",
      satisfied: input.candidateCount > 0,
      detail: `candidateCount=${input.candidateCount}`,
    },
  ]);
}

export function appendKnowledgePackMetadataRegistryCandidateFindings(input: {
  readonly findings: KnowledgePackMetadataRegistryCandidateFinding[];
  readonly decision: KnowledgePackMetadataRegistryCandidateDecision;
  readonly sourceStage5AClosureDecision: KnowledgePackMetadataRegistryCandidateDecisionInput["sourceStage5AClosureDecision"];
  readonly validation: MetadataCandidateValidation;
}): void {
  const { findings, decision, sourceStage5AClosureDecision, validation } = input;

  findings.push(finding("info", "stage5_b_candidate_evaluator_created", "Stage 5-B metadata registry candidate evaluator created"));
  findings.push(finding("info", "stage5_b_registry_candidate_only", "Stage 5-B is registry candidate only"));
  findings.push(finding("info", "stage5_b_no_crud", "Stage 5-B does not implement knowledge pack CRUD"));
  findings.push(finding("info", "stage5_b_no_db_write", "Stage 5-B does not write to DB"));
  findings.push(finding("info", "stage5_b_no_rag", "Stage 5-B does not use RAG indexing"));

  if (sourceStage5AClosureDecision === "blocked") {
    findings.push(finding("blocking", "source_stage5_a_closure_blocked", "Source Stage 5-A closure is blocked"));
    findings.push(finding("blocking", "stage5_b_candidate_blocked", "Stage 5-B metadata registry candidate is blocked"));
    return;
  }

  if (validation.hasBlockedCandidate) {
    if (validation.blankIds.length > 0) {
      findings.push(finding("blocking", "metadata_candidate_blank_id", "Metadata candidate has blank knowledge pack id"));
    }
    if (validation.invalidCategoryIds.length > 0) {
      findings.push(finding("blocking", "metadata_candidate_invalid_category", "Metadata candidate has invalid category"));
    }
    if (validation.invalidStatusIds.length > 0) {
      findings.push(finding("blocking", "metadata_candidate_invalid_status", "Metadata candidate has invalid status"));
    }
    findings.push(finding("blocking", "stage5_b_candidate_blocked", "Stage 5-B metadata registry candidate is blocked"));
    return;
  }

  if (decision === "defer") {
    if (sourceStage5AClosureDecision === "defer") {
      findings.push(finding("warning", "source_stage5_a_closure_deferred", "Source Stage 5-A closure defers"));
    }
    if (validation.hasMissingRequiredFields) {
      findings.push(finding("warning", "metadata_required_fields_incomplete", "Metadata required fields are incomplete"));
    }
    findings.push(finding("warning", "stage5_b_candidate_deferred", "Stage 5-B metadata registry candidate defers"));
    return;
  }

  findings.push(finding("info", "stage5_b_candidate_ready", "Stage 5-B metadata registry candidate is ready for design"));
}
