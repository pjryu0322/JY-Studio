import type { ExecutionReviewerStepRecord } from "@/lib/execution/executionReviewWithAiMembers";

export type TeamRuntimePhaseStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type ParsedTeamReviewPhases = Readonly<{
  reviewer: { status: TeamRuntimePhaseStatus; issues: readonly string[]; configured: boolean };
  security: { status: TeamRuntimePhaseStatus; issues: readonly string[]; configured: boolean };
}>;

function isFailDecision(decision: string): boolean {
  const d = decision.trim().toLowerCase();
  return d === "fail" || d === "failed" || d === "reject" || d === "rejected";
}

function isPassDecision(decision: string): boolean {
  const d = decision.trim().toLowerCase();
  return d === "pass" || d === "done" || d === "approve" || d === "approved";
}

function phaseFromSteps(
  steps: readonly ExecutionReviewerStepRecord[],
  roleMatcher: (role: string) => boolean
): { status: TeamRuntimePhaseStatus; issues: readonly string[]; configured: boolean } {
  const matched = steps.filter((s) => roleMatcher(String(s.role ?? "").toLowerCase()));
  if (matched.length === 0) {
    return { status: "skipped", issues: [], configured: false };
  }
  const issues = matched.flatMap((s) => (Array.isArray(s.issues) ? s.issues : []));
  if (matched.some((s) => isFailDecision(s.decision))) {
    return { status: "failed", issues, configured: true };
  }
  if (matched.every((s) => isPassDecision(s.decision))) {
    return { status: "completed", issues, configured: true };
  }
  return { status: "running", issues, configured: true };
}

export function parseTeamReviewPhasesFromReviewerSteps(
  steps: readonly ExecutionReviewerStepRecord[] | null | undefined
): ParsedTeamReviewPhases {
  const list = Array.isArray(steps) ? steps : [];
  const reviewer = phaseFromSteps(
    list,
    (role) => role === "reviewer" || role === "quality-reviewer"
  );
  const security = phaseFromSteps(list, (role) => role === "security-reviewer");
  return { reviewer, security };
}
