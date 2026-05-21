/**
 * Stage 5-D prompt context injection design candidate support (read-only).
 */

import { DEFAULT_ROLE_KNOWLEDGE_BINDINGS, listDefaultRoleKnowledgeAgentTypes } from "@/lib/agents/defaultRoleKnowledgeBindings";
import type { RoleKnowledgeInjectionMode } from "@/lib/agents/roleKnowledgeBindingTypes";
import type { RoleKnowledgePackMappingCandidate } from "@/lib/agents/roleKnowledgePackMappingCandidateTypes";
import type {
  PromptContextInjectionDesignCandidate,
  PromptContextInjectionDesignCandidateChecklistItem,
  PromptContextInjectionDesignCandidateDecision,
  PromptContextInjectionDesignCandidateDecisionInput,
  PromptContextInjectionDesignCandidateFinding,
  PromptContextInjectionDesignCandidateInput,
  PromptContextInjectionMode,
  PromptContextInjectionTiming,
  PromptContextMaxContextPolicy,
} from "@/lib/agents/promptContextInjectionDesignCandidateTypes";

export const SUPPORTED_INJECTION_MODES: readonly PromptContextInjectionMode[] = [
  "none",
  "summary_only",
  "selected_sections",
  "retrieval_candidate",
];

const AGENT_TIMING: Record<string, PromptContextInjectionTiming> = {
  planner: "planning",
  analyst: "analysis",
  architect: "design",
  designer: "design",
  developer: "implementation_request",
  reviewer: "review",
  security: "security_review",
  scm: "review",
  operator: "review",
};

const AGENT_MAX_CONTEXT: Record<string, PromptContextMaxContextPolicy> = {
  planner: "standard",
  analyst: "standard",
  architect: "expanded",
  designer: "standard",
  developer: "expanded",
  reviewer: "standard",
  security: "minimal",
  scm: "minimal",
  operator: "minimal",
};

function bindingModeToDesignMode(mode: RoleKnowledgeInjectionMode): PromptContextInjectionMode {
  switch (mode) {
    case "summary_only":
      return "summary_only";
    case "retrieval_required":
      return "retrieval_candidate";
    case "checklist_only":
      return "selected_sections";
    case "disabled":
      return "none";
    default:
      return "summary_only";
  }
}

function dominantInjectionMode(agentType: string): PromptContextInjectionMode {
  const bindings = DEFAULT_ROLE_KNOWLEDGE_BINDINGS[agentType] ?? [];
  const required = bindings.filter((b) => b.required);
  const source = required.length > 0 ? required : bindings;
  const modes = source.map((b) => bindingModeToDesignMode(b.injectionMode));
  if (modes.includes("retrieval_candidate")) {
    return "retrieval_candidate";
  }
  if (modes.includes("selected_sections")) {
    return "selected_sections";
  }
  if (modes.every((m) => m === "none")) {
    return "none";
  }
  return "summary_only";
}

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: PromptContextInjectionDesignCandidateFinding["severity"],
  code: string,
  message: string,
): PromptContextInjectionDesignCandidateFinding {
  return { severity, code, message };
}

function mapChecklist(entries: readonly ChecklistEntry[]): PromptContextInjectionDesignCandidateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function buildDefaultPromptContextInjectionDesignCandidates(
  mappings: readonly RoleKnowledgePackMappingCandidate[],
): readonly PromptContextInjectionDesignCandidate[] {
  return mappings
    .map((mapping) => ({
      agentType: mapping.agentType,
      injectionMode: dominantInjectionMode(mapping.agentType),
      maxContextPolicy: AGENT_MAX_CONTEXT[mapping.agentType] ?? "standard",
      requiredKnowledgePackIds: [...mapping.requiredKnowledgePackIds],
      optionalKnowledgePackIds: [...mapping.optionalKnowledgePackIds],
      injectionTiming: AGENT_TIMING[mapping.agentType] ?? "review",
      designReason: `Prompt context injection design candidate for ${mapping.agentType}`,
    }))
    .sort((a, b) => a.agentType.localeCompare(b.agentType));
}

export function parsePromptContextInjectionDesignCandidateInput(input?: PromptContextInjectionDesignCandidateInput): {
  readonly agentTypes: readonly string[];
} {
  const agentTypes =
    input?.agentTypes === undefined
      ? listDefaultRoleKnowledgeAgentTypes()
      : [...input.agentTypes].map((t) => t.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));

  return { agentTypes };
}

export type DesignValidation = {
  readonly hasUnsupportedInjectionMode: boolean;
  readonly hasMissingDesignAgent: boolean;
  readonly unsupportedInjectionModes: readonly string[];
  readonly missingMappingAgentTypes: readonly string[];
};

export function validatePromptContextInjectionDesigns(input: {
  readonly agentTypes: readonly string[];
  readonly designCandidates: readonly PromptContextInjectionDesignCandidate[];
}): DesignValidation {
  const designByAgent = new Map(input.designCandidates.map((d) => [d.agentType, d]));
  const unsupported = new Set<string>();
  const missing: string[] = [];

  for (const agentType of input.agentTypes) {
    const design = designByAgent.get(agentType);
    if (!design) {
      missing.push(agentType);
      continue;
    }
    if (!SUPPORTED_INJECTION_MODES.includes(design.injectionMode)) {
      unsupported.add(design.injectionMode);
    }
  }

  return {
    hasUnsupportedInjectionMode: unsupported.size > 0,
    hasMissingDesignAgent: missing.length > 0,
    unsupportedInjectionModes: [...unsupported].sort((a, b) => a.localeCompare(b)),
    missingMappingAgentTypes: missing.sort((a, b) => a.localeCompare(b)),
  };
}

export function resolvePromptContextInjectionDesignCandidateDecision(
  input: PromptContextInjectionDesignCandidateDecisionInput,
): PromptContextInjectionDesignCandidateDecision {
  if (input.sourceStage5CDecision === "blocked" || input.hasUnsupportedInjectionMode) {
    return "blocked";
  }

  if (input.sourceStage5CDecision === "defer" || input.hasMissingDesignAgent) {
    return "defer";
  }

  return "ready_for_prompt_context_design";
}

export function buildPromptContextInjectionDesignCandidateChecklist(input: {
  readonly sourceStage5CDecision: PromptContextInjectionDesignCandidateDecisionInput["sourceStage5CDecision"];
  readonly validation: DesignValidation;
  readonly designCandidateCount: number;
}): PromptContextInjectionDesignCandidateChecklistItem[] {
  return mapChecklist([
    {
      item: "source Stage 5-C not blocked",
      satisfied: input.sourceStage5CDecision !== "blocked",
      detail: `sourceStage5CDecision=${input.sourceStage5CDecision}`,
    },
    {
      item: "source Stage 5-C ready for mapping design",
      satisfied: input.sourceStage5CDecision === "ready_for_mapping_design",
      detail: `sourceStage5CDecision=${input.sourceStage5CDecision}`,
    },
    {
      item: "no unsupported injection modes",
      satisfied: input.validation.unsupportedInjectionModes.length === 0,
      detail: `unsupported=${input.validation.unsupportedInjectionModes.join(",") || "none"}`,
    },
    {
      item: "design exists for all mapped agents",
      satisfied: input.validation.missingMappingAgentTypes.length === 0,
      detail: `missing=${input.validation.missingMappingAgentTypes.join(",") || "none"}`,
    },
    {
      item: "prompt injection design only",
      satisfied: true,
      detail: "promptInjectionDesignOnly=true",
    },
    {
      item: "actual RAG retrieval disallowed",
      satisfied: true,
      detail: "actualRagRetrievalAllowedInThisStep=false",
    },
    {
      item: "design candidate count positive",
      satisfied: input.designCandidateCount > 0,
      detail: `designCandidateCount=${input.designCandidateCount}`,
    },
  ]);
}

export function appendPromptContextInjectionDesignCandidateFindings(input: {
  readonly findings: PromptContextInjectionDesignCandidateFinding[];
  readonly decision: PromptContextInjectionDesignCandidateDecision;
  readonly sourceStage5CDecision: PromptContextInjectionDesignCandidateDecisionInput["sourceStage5CDecision"];
  readonly validation: DesignValidation;
}): void {
  const { findings, decision, sourceStage5CDecision, validation } = input;

  findings.push(finding("info", "stage5_d_design_candidate_evaluator_created", "Stage 5-D design candidate evaluator created"));
  findings.push(finding("info", "stage5_d_prompt_injection_design_only", "Stage 5-D is prompt injection design only"));
  findings.push(finding("info", "stage5_d_no_prompt_wire", "Stage 5-D does not wire prompt injection"));
  findings.push(finding("info", "stage5_d_no_rag_retrieval", "Stage 5-D does not allow actual RAG retrieval"));

  if (sourceStage5CDecision === "blocked") {
    findings.push(finding("blocking", "source_stage5_c_blocked", "Source Stage 5-C decision is blocked"));
    findings.push(finding("blocking", "stage5_d_design_blocked", "Stage 5-D prompt context design candidate is blocked"));
    return;
  }

  if (validation.hasUnsupportedInjectionMode) {
    findings.push(finding("blocking", "unsupported_injection_mode", "Unsupported injection mode in design candidate"));
    findings.push(finding("blocking", "stage5_d_design_blocked", "Stage 5-D prompt context design candidate is blocked"));
    return;
  }

  if (decision === "defer") {
    if (sourceStage5CDecision === "defer") {
      findings.push(finding("warning", "source_stage5_c_deferred", "Source Stage 5-C decision defers"));
    }
    if (validation.hasMissingDesignAgent) {
      findings.push(finding("warning", "design_missing_for_agent", "Prompt design missing for one or more agent types"));
    }
    findings.push(finding("warning", "stage5_d_design_deferred", "Stage 5-D prompt context design candidate defers"));
    return;
  }

  findings.push(finding("info", "stage5_d_design_ready", "Stage 5-D prompt context design candidate is ready"));
}
