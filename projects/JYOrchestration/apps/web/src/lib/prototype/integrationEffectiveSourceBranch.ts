export type IntegrationEffectiveSourceBranchReasonV1 =
  | "context_source_branch"
  | "latest_verified_work_branch"
  | "topology_chain_head"
  | "source_branch_missing"
  | "source_branch_is_target_branch"
  | "source_branch_not_in_included_work_branches";

export type ResolveEffectiveIntegrationSourceBranchResultV1 = Readonly<{
  readonly ok: boolean;
  readonly sourceBranch: string | null;
  readonly reason: IntegrationEffectiveSourceBranchReasonV1;
  readonly diagnostic: Readonly<{
    readonly contextSourceBranch: string | null;
    readonly contextTargetBranch: string | null;
    readonly contextIntegrationBranch: string | null;
    readonly topologyChainHead: string | null;
    readonly includedWorkBranches: readonly string[];
    readonly latestVerifiedWorkBranch: string | null;
  }>;
}>;

function normalizeBranch(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function includedSet(branches: readonly string[]): Set<string> {
  return new Set(branches.map((b) => b.trim()).filter(Boolean));
}

function isIncluded(branch: string, branches: readonly string[]): boolean {
  return includedSet(branches).has(branch.trim());
}

function isForbiddenIntegrationSourceBranch(input: {
  readonly branch: string;
  readonly contextTargetBranch: string | null;
  readonly contextIntegrationBranch: string | null;
  readonly includedWorkBranches: readonly string[];
}): boolean {
  const branch = input.branch.trim();
  if (!branch) return true;
  if (input.contextTargetBranch && branch === input.contextTargetBranch) return true;
  if (input.contextIntegrationBranch && branch === input.contextIntegrationBranch) return true;
  if (branch.startsWith("wip/integration/") && !isIncluded(branch, input.includedWorkBranches)) {
    return true;
  }
  if (branch.startsWith("integration/") && !isIncluded(branch, input.includedWorkBranches)) {
    return true;
  }
  return false;
}

function tryCandidate(input: {
  readonly branch: string | null;
  readonly contextTargetBranch: string | null;
  readonly contextIntegrationBranch: string | null;
  readonly includedWorkBranches: readonly string[];
  readonly successReason: IntegrationEffectiveSourceBranchReasonV1;
}): Readonly<{
  readonly ok: boolean;
  readonly sourceBranch: string | null;
  readonly reason: IntegrationEffectiveSourceBranchReasonV1;
}> {
  const branch = normalizeBranch(input.branch);
  if (!branch) {
    return { ok: false, sourceBranch: null, reason: "source_branch_missing" };
  }
  if (
    isForbiddenIntegrationSourceBranch({
      branch,
      contextTargetBranch: input.contextTargetBranch,
      contextIntegrationBranch: input.contextIntegrationBranch,
      includedWorkBranches: input.includedWorkBranches,
    })
  ) {
    return { ok: false, sourceBranch: null, reason: "source_branch_is_target_branch" };
  }
  if (!isIncluded(branch, input.includedWorkBranches)) {
    return {
      ok: false,
      sourceBranch: null,
      reason: "source_branch_not_in_included_work_branches",
    };
  }
  return { ok: true, sourceBranch: branch, reason: input.successReason };
}

export function resolveEffectiveIntegrationSourceBranch(input: {
  readonly contextSourceBranch: string | null;
  readonly contextTargetBranch: string | null;
  readonly contextIntegrationBranch: string | null;
  readonly topologyChainHead: string | null;
  readonly includedWorkBranches: readonly string[];
  readonly latestVerifiedWorkBranch?: string | null;
}): ResolveEffectiveIntegrationSourceBranchResultV1 {
  const diagnostic = {
    contextSourceBranch: normalizeBranch(input.contextSourceBranch),
    contextTargetBranch: normalizeBranch(input.contextTargetBranch),
    contextIntegrationBranch: normalizeBranch(input.contextIntegrationBranch),
    topologyChainHead: normalizeBranch(input.topologyChainHead),
    includedWorkBranches: [...input.includedWorkBranches],
    latestVerifiedWorkBranch: normalizeBranch(input.latestVerifiedWorkBranch),
  };

  const candidates: ReadonlyArray<{
    readonly branch: string | null;
    readonly successReason: IntegrationEffectiveSourceBranchReasonV1;
  }> = [
    { branch: diagnostic.contextSourceBranch, successReason: "context_source_branch" },
    { branch: diagnostic.latestVerifiedWorkBranch, successReason: "latest_verified_work_branch" },
    { branch: diagnostic.topologyChainHead, successReason: "topology_chain_head" },
  ];

  for (const candidate of candidates) {
    const attempt = tryCandidate({
      branch: candidate.branch,
      contextTargetBranch: diagnostic.contextTargetBranch,
      contextIntegrationBranch: diagnostic.contextIntegrationBranch,
      includedWorkBranches: diagnostic.includedWorkBranches,
      successReason: candidate.successReason,
    });
    if (attempt.ok) {
      return {
        ok: true,
        sourceBranch: attempt.sourceBranch,
        reason: attempt.reason,
        diagnostic,
      };
    }
  }

  return {
    ok: false,
    sourceBranch: null,
    reason: "source_branch_missing",
    diagnostic,
  };
}

export function resolveLatestVerifiedWorkBranchFromIncluded(input: {
  readonly included: readonly Readonly<{ readonly codeTaskId: string; readonly workBranch?: string | null }>[];
  readonly codeTaskPlan: { readonly tasks?: readonly Readonly<{ readonly codeTaskId: string; readonly order?: number }> } | null;
}): string | null {
  let best: { order: number; branch: string } | null = null;
  for (const item of input.included) {
    const branch = normalizeBranch(item.workBranch);
    if (!branch) continue;
    const task = input.codeTaskPlan?.tasks?.find((t) => t.codeTaskId === item.codeTaskId);
    const order = typeof task?.order === "number" ? task.order : 0;
    if (!best || order >= best.order) {
      best = { order, branch };
    }
  }
  return best?.branch ?? null;
}
