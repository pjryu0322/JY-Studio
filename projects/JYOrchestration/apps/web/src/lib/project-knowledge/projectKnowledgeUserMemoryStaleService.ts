import {
  PROJECT_KNOWLEDGE_AGENTS,
  type ProjectKnowledgeAgent,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import { loadUserProjectKnowledgeMemoryControlForProject } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlProjectPersistence";
import {
  buildUserProjectKnowledgeMemoryPreview,
  type UserProjectKnowledgeMemoryPreviewItemV1,
  type UserProjectKnowledgeMemoryPreviewV1,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryPreviewService";
import { loadUserProjectKnowledgeMemoryUsageStateForProject } from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsagePersistence";
import { summarizeUserProjectKnowledgeMemoryUsage } from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsage";
import type {
  UserProjectKnowledgeMemoryStaleCandidateV1,
  UserProjectKnowledgeMemoryStalePreviewV1,
  UserProjectKnowledgeMemoryStaleReason,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryStaleTypes";
import { USER_PROJECT_KNOWLEDGE_MEMORY_STALE_STATE_VERSION } from "@/lib/project-knowledge/projectKnowledgeUserMemoryStaleTypes";

const LOW_RELEVANCE_THRESHOLD = 0.4;
const DEFAULT_MAX_CANDIDATES = 10;

function staleReasonPriority(reason: UserProjectKnowledgeMemoryStaleReason): number {
  if (reason === "ignored") return 0;
  if (reason === "low_relevance") return 1;
  if (reason === "not_recently_used") return 2;
  if (reason === "old_source_project") return 3;
  return 4;
}

function compareCandidates(
  a: UserProjectKnowledgeMemoryStaleCandidateV1,
  b: UserProjectKnowledgeMemoryStaleCandidateV1,
): number {
  const aPri = Math.min(...a.reasons.map(staleReasonPriority));
  const bPri = Math.min(...b.reasons.map(staleReasonPriority));
  if (aPri !== bPri) return aPri - bPri;
  const aRel = a.relevance ?? 1;
  const bRel = b.relevance ?? 1;
  return aRel - bRel;
}

function toCandidate(input: {
  readonly item: UserProjectKnowledgeMemoryPreviewItemV1;
  readonly reasons: readonly UserProjectKnowledgeMemoryStaleReason[];
  readonly lastUsedAt?: string;
}): UserProjectKnowledgeMemoryStaleCandidateV1 {
  return {
    actionId: input.item.actionId,
    agent: input.item.agent,
    title: input.item.title,
    promptSummary: input.item.promptSummary,
    sourceProjectTitle: input.item.sourceProjectTitle,
    reasons: input.reasons,
    relevance: input.item.relevance,
    lastUsedAt: input.lastUsedAt,
    ignored: input.item.ignored,
    pinned: input.item.pinned,
  };
}

/** Pure builder for tests and panel aggregation. */
export function buildUserProjectKnowledgeMemoryStalePreviewFromSources(input: {
  readonly preview: UserProjectKnowledgeMemoryPreviewV1;
  readonly maxCandidates?: number;
  readonly agentLastUsedAt?: Readonly<Partial<Record<ProjectKnowledgeAgent, string>>>;
}): UserProjectKnowledgeMemoryStalePreviewV1 {
  const maxCandidates = Math.max(1, Math.min(50, Math.floor(input.maxCandidates ?? DEFAULT_MAX_CANDIDATES)));
  const byActionId = new Map<string, UserProjectKnowledgeMemoryStaleCandidateV1>();

  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    const block = input.preview.byAgent[agent];
    const rows = [...block.items, ...(block.ignoredItems ?? [])];
    for (const item of rows) {
      if (item.pinned) continue;

      const reasons: UserProjectKnowledgeMemoryStaleReason[] = [];
      if (item.ignored) {
        reasons.push("ignored");
      }
      if (item.relevance < LOW_RELEVANCE_THRESHOLD) {
        reasons.push("low_relevance");
      }

      // TODO(not_recently_used): correlate opaque actionId with usage events when a stable join exists.
      const agentLastUsed = input.agentLastUsedAt?.[agent];
      if (
        !item.ignored &&
        agentLastUsed == null &&
        block.itemCount > 0 &&
        item.relevance < LOW_RELEVANCE_THRESHOLD
      ) {
        // covered by low_relevance for 1st release
      }

      if (!reasons.length) continue;

      const existing = byActionId.get(item.actionId);
      const mergedReasons = existing
        ? [...new Set([...existing.reasons, ...reasons])]
        : reasons;
      byActionId.set(
        item.actionId,
        toCandidate({
          item,
          reasons: mergedReasons,
          lastUsedAt: input.agentLastUsedAt?.[item.agent],
        }),
      );
    }
  }

  const candidates = [...byActionId.values()].sort(compareCandidates).slice(0, maxCandidates);

  return {
    version: USER_PROJECT_KNOWLEDGE_MEMORY_STALE_STATE_VERSION,
    candidateCount: candidates.length,
    candidates,
  };
}

export async function buildUserProjectKnowledgeMemoryStalePreview(input: {
  readonly userId: string;
  readonly targetProjectId: string;
  readonly maxCandidates?: number;
}): Promise<UserProjectKnowledgeMemoryStalePreviewV1> {
  const projectId = input.targetProjectId.trim();
  const control = await loadUserProjectKnowledgeMemoryControlForProject(projectId);
  const preview = await buildUserProjectKnowledgeMemoryPreview({
    userId: input.userId,
    targetProjectId: projectId,
    control,
  });
  const usageState = await loadUserProjectKnowledgeMemoryUsageStateForProject(projectId);
  const usageSummary = summarizeUserProjectKnowledgeMemoryUsage({ state: usageState, limit: 20 });
  const agentLastUsedAt = {} as Partial<Record<ProjectKnowledgeAgent, string>>;
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    const at = usageSummary.byAgent[agent].lastUsedAt;
    if (at) agentLastUsedAt[agent] = at;
  }

  return buildUserProjectKnowledgeMemoryStalePreviewFromSources({
    preview,
    maxCandidates: input.maxCandidates,
    agentLastUsedAt,
  });
}
