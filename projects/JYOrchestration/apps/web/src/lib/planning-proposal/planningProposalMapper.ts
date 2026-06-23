import { createHash } from "node:crypto";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { coerceRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { hasProposalFirstStructure } from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import type {
  PlanningProposalModel,
  PlanningProposalType,
} from "@/lib/planning-proposal/planningProposalModel";
import {
  PLANNING_PROPOSAL_ACCEPTED_BY,
  PLANNING_PROPOSAL_CREATED_BY,
} from "@/lib/planning-proposal/planningProposalModel";

export type ParsedAcceptedProposalSnapshot = Readonly<{
  readonly actors: readonly string[];
  readonly features: readonly string[];
  readonly requirements: readonly string[];
  readonly flows: readonly string[];
  readonly decisions: readonly string[];
  readonly assumptions: readonly string[];
  readonly scope: Readonly<{ readonly included: readonly string[]; readonly excluded: readonly string[] }>;
}>;

type SectionKey = keyof ParsedAcceptedProposalSnapshot extends infer K
  ? K extends "scope"
    ? never
    : K
  : never;

const SECTION_RULES: readonly { readonly key: SectionKey; readonly labels: readonly RegExp[] }[] = [
  { key: "flows", labels: [/예상\s*서비스\s*흐름/i, /서비스\s*흐름/i] },
  { key: "actors", labels: [/예상\s*액터/i, /액터·역할/i, /주요\s*액터/i, /액터/i] },
  { key: "features", labels: [/예상\s*핵심\s*기능/i, /핵심\s*기능/i] },
  { key: "requirements", labels: [/요구\s*사항/i, /세부\s*요구/i] },
  { key: "decisions", labels: [/결정\s*사항/i, /추천안/i] },
  { key: "assumptions", labels: [/가정/i, /전제/i] },
];

function normalizeLine(line: string): string {
  return String(line ?? "")
    .replace(/^[-*•]\s+/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
}

function splitListLines(block: string, max = 24): string[] {
  const lines = String(block ?? "")
    .split(/\n+/)
    .map(normalizeLine)
    .filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    if (/^[:：]\s*$/.test(line)) continue;
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

function detectSectionHeader(line: string): SectionKey | "scope" | null {
  const t = line.trim();
  for (const rule of SECTION_RULES) {
    if (rule.labels.some((re) => re.test(t))) return rule.key;
  }
  if (/범위|scope/i.test(t) && /포함|제외/i.test(t)) return "scope";
  if (/^포함/i.test(t) || /^제외/i.test(t)) return "scope";
  return null;
}

export function parseAcceptedProposalSnapshot(text: string): ParsedAcceptedProposalSnapshot {
  const raw = String(text ?? "").trim();
  const empty = {
    actors: [] as string[],
    features: [] as string[],
    requirements: [] as string[],
    flows: [] as string[],
    decisions: [] as string[],
    assumptions: [] as string[],
    scope: { included: [] as string[], excluded: [] as string[] },
  };
  if (!raw) return empty;

  const lines = raw.split(/\n/);
  let current: SectionKey | "scope" | null = null;
  const buckets: Record<SectionKey, string[]> = {
    actors: [],
    features: [],
    requirements: [],
    flows: [],
    decisions: [],
    assumptions: [],
  };
  const scopeIncluded: string[] = [];
  const scopeExcluded: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const header = detectSectionHeader(trimmed);
    if (header) {
      current = header;
      const afterColon = trimmed.split(/[:：]/).slice(1).join(":").trim();
      if (afterColon) {
        if (header === "scope") {
          if (/제외/i.test(trimmed)) scopeExcluded.push(normalizeLine(afterColon));
          else scopeIncluded.push(normalizeLine(afterColon));
        } else {
          buckets[header].push(normalizeLine(afterColon));
        }
      }
      continue;
    }
    if (!current) continue;
    if (current === "scope") {
      if (/제외/i.test(trimmed)) scopeExcluded.push(normalizeLine(trimmed));
      else scopeIncluded.push(normalizeLine(trimmed));
      continue;
    }
    buckets[current].push(normalizeLine(trimmed));
  }

  return {
    actors: splitListLines(buckets.actors.join("\n")),
    features: splitListLines(buckets.features.join("\n")),
    requirements: splitListLines(buckets.requirements.join("\n")),
    flows: splitListLines(buckets.flows.join("\n")),
    decisions: splitListLines(buckets.decisions.join("\n"), 12),
    assumptions: splitListLines(buckets.assumptions.join("\n"), 12),
    scope: {
      included: scopeIncluded.filter(Boolean).slice(0, 16),
      excluded: scopeExcluded.filter(Boolean).slice(0, 16),
    },
  };
}

export function inferPlanningProposalType(parsed: ParsedAcceptedProposalSnapshot): PlanningProposalType {
  const hasFlow = parsed.flows.length > 0;
  const hasActor = parsed.actors.length > 0;
  const hasFeature = parsed.features.length > 0;
  const kinds = [hasFlow, hasActor, hasFeature].filter(Boolean).length;
  if (kinds > 1) return "mixed";
  if (hasFlow) return "service_flow";
  if (hasActor) return "actor_definition";
  if (hasFeature) return "feature_definition";
  if (parsed.scope.included.length || parsed.scope.excluded.length) return "scope_decision";
  return "mixed";
}

export function planningProposalPayloadFromModel(proposal: PlanningProposalModel): Record<string, unknown> {
  return {
    proposalId: proposal.proposalId,
    proposalType: proposal.proposalType,
    sourceMessageId: proposal.sourceMessageId,
    acceptedByMessageId: proposal.acceptedByMessageId,
    acceptedAt: proposal.acceptedAt,
    acceptedSnapshot: proposal.acceptedSnapshot,
    actors: [...proposal.actors],
    features: [...proposal.features],
    requirements: [...proposal.requirements],
    flows: [...proposal.flows],
    decisions: [...proposal.decisions],
    assumptions: [...proposal.assumptions],
    scope: {
      included: [...proposal.scope.included],
      excluded: [...proposal.scope.excluded],
    },
    createdBy: proposal.createdBy,
    acceptedBy: proposal.acceptedBy,
  };
}

export function parsePlanningProposalFromEventPayload(
  projectId: string,
  payload: unknown,
  sourceMessageId: string | null | undefined,
): PlanningProposalModel | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  const readList = (key: string): string[] => {
    const v = p[key];
    if (!Array.isArray(v)) return [];
    return v.map((x) => String(x).trim()).filter(Boolean);
  };
  const scopeRaw = p.scope;
  let included: string[] = [];
  let excluded: string[] = [];
  if (scopeRaw && typeof scopeRaw === "object" && !Array.isArray(scopeRaw)) {
    const s = scopeRaw as Record<string, unknown>;
    included = Array.isArray(s.included) ? s.included.map((x) => String(x).trim()).filter(Boolean) : [];
    excluded = Array.isArray(s.excluded) ? s.excluded.map((x) => String(x).trim()).filter(Boolean) : [];
  }
  const sid = String(p.sourceMessageId ?? sourceMessageId ?? "").trim();
  const acceptedBy = String(p.acceptedByMessageId ?? "").trim();
  const proposalId = String(p.proposalId ?? "").trim();
  if (!sid || !acceptedBy || !proposalId) return null;
  const proposalType = String(p.proposalType ?? "mixed").trim() as PlanningProposalType;
  return {
    projectId: String(p.projectId ?? projectId).trim(),
    proposalId,
    proposalType,
    sourceMessageId: sid,
    acceptedByMessageId: acceptedBy,
    acceptedAt: String(p.acceptedAt ?? new Date().toISOString()),
    acceptedSnapshot: String(p.acceptedSnapshot ?? "").slice(0, 8000),
    actors: readList("actors"),
    features: readList("features"),
    requirements: readList("requirements"),
    flows: readList("flows"),
    decisions: readList("decisions"),
    assumptions: readList("assumptions"),
    scope: { included, excluded },
    createdBy: PLANNING_PROPOSAL_CREATED_BY,
    acceptedBy: PLANNING_PROPOSAL_ACCEPTED_BY,
  };
}

function readConversationMessages(conversationJson: unknown): RequirementsMessage[] {
  if (!conversationJson || typeof conversationJson !== "object") return [];
  const messages = (conversationJson as Record<string, unknown>).messages;
  if (!Array.isArray(messages)) return [];
  const out: RequirementsMessage[] = [];
  for (const raw of messages) {
    const m = coerceRequirementsMessage(raw);
    if (m) out.push(m);
  }
  return out;
}

export function resolveProposalMessageIdsFromConversation(
  conversationJson: unknown,
  acceptedSnapshot: string,
): Readonly<{ readonly sourceMessageId: string; readonly acceptedByMessageId: string }> {
  const messages = readConversationMessages(conversationJson);
  let acceptedByMessageId = "";
  let sourceMessageId = "";
  const snapPrefix = acceptedSnapshot.trim().slice(0, 80);

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]!;
    const role = String(m.role ?? "").toLowerCase();
    if (!acceptedByMessageId && role === "user") {
      acceptedByMessageId = String(m.id ?? "").trim();
    }
    if (!sourceMessageId && (role === "assistant" || role === "ai")) {
      const content = String(m.content ?? "").trim();
      if (
        (snapPrefix && content.includes(snapPrefix.slice(0, 40))) ||
        hasProposalFirstStructure(content)
      ) {
        sourceMessageId = String(m.id ?? "").trim();
      }
    }
    if (acceptedByMessageId && sourceMessageId) break;
  }

  if (!sourceMessageId) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i]!;
      if (String(m.role ?? "").toLowerCase() === "assistant") {
        sourceMessageId = String(m.id ?? "").trim();
        break;
      }
    }
  }

  return {
    sourceMessageId: sourceMessageId || acceptedByMessageId || `proposal-${hashProposalFallback(acceptedSnapshot)}`,
    acceptedByMessageId: acceptedByMessageId || sourceMessageId || `apply-${hashProposalFallback(acceptedSnapshot)}`,
  };
}

function hashProposalFallback(text: string): string {
  return createHash("sha256").update(String(text ?? "")).digest("hex").slice(0, 12);
}

export function buildPlanningProposalModel(input: Readonly<{
  readonly projectId: string;
  readonly proposalId: string;
  readonly acceptedSnapshot: string;
  readonly acceptedAt: string;
  readonly sourceMessageId: string;
  readonly acceptedByMessageId: string;
}>): PlanningProposalModel {
  const parsed = parseAcceptedProposalSnapshot(input.acceptedSnapshot);
  return {
    projectId: input.projectId.trim(),
    proposalId: input.proposalId.trim(),
    proposalType: inferPlanningProposalType(parsed),
    sourceMessageId: input.sourceMessageId.trim(),
    acceptedByMessageId: input.acceptedByMessageId.trim(),
    acceptedAt: input.acceptedAt,
    acceptedSnapshot: input.acceptedSnapshot.trim().slice(0, 8000),
    actors: parsed.actors,
    features: parsed.features,
    requirements: parsed.requirements,
    flows: parsed.flows,
    decisions: parsed.decisions,
    assumptions: parsed.assumptions,
    scope: parsed.scope,
    createdBy: PLANNING_PROPOSAL_CREATED_BY,
    acceptedBy: PLANNING_PROPOSAL_ACCEPTED_BY,
  };
}
