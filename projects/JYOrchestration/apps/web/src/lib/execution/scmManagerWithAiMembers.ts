import { runOpenAiChatJsonEvaluation } from "@/lib/execution/openAiRelayEvaluation";
import { prisma } from "@/lib/prisma";
import { resolveEffectiveReviewerModel } from "@/lib/ai-member/aiMemberOrchestration";

export type ScmManagerDecision = "approve_merge" | "hold" | "reject";

export type ScmManagerStepRecord = {
  memberId: string;
  name: string;
  role: string;
  model: string;
  decision: ScmManagerDecision;
  summary: string;
  issues: string[];
  reviewedAt: string;
};

function buildScmManagerContext(params: {
  repoUrl: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string | null;
  branch: string;
  baseBranch: string;
  reviewerDecision: string;
  reviewerSummary: string;
}): string {
  return `You are an AI SCM manager. Your job is to decide whether to create a PR and merge.

[Repo]
${params.repoUrl}

[Task]
id=${params.taskId}
title=${params.taskTitle}
description=${params.taskDescription ?? "(none)"}

[Branch]
base=${params.baseBranch}
head=${params.branch}

[Reviewer]
decision=${params.reviewerDecision}
summary=${params.reviewerSummary.slice(0, 6000)}

[Policy]
- Only approve_merge if reviewer approved and no critical issues.
- If uncertain, choose "hold".
- Output only ONE JSON object.`;
}

export async function countScmManagerAiMembers(projectId: string): Promise<number> {
  return prisma.projectMember.count({
    where: {
      projectId,
      memberType: "AI",
      orchestrationEnabled: true,
      orchestrationStage: "scm-manager",
      aiOrchestrationRole: "scm-manager",
    },
  });
}

export async function tryRunScmManagerWithAiMembers(params: {
  projectId: string;
  repoUrl: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string | null;
  branch: string;
  baseBranch: string;
  reviewerDecision: string;
  reviewerSummary: string;
}): Promise<{ decision: ScmManagerDecision; summary: string; steps: ScmManagerStepRecord[] } | null> {
  const rows = await prisma.projectMember.findMany({
    where: {
      projectId: params.projectId,
      memberType: "AI",
      orchestrationEnabled: true,
      orchestrationStage: "scm-manager",
      aiOrchestrationRole: "scm-manager",
    },
    select: {
      id: true,
      displayName: true,
      aiModelOverride: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (rows.length === 0) return null;

  const m = rows[0];
  const model = resolveEffectiveReviewerModel("reviewer", m.aiModelOverride);
  const userMessage = buildScmManagerContext({ ...params, projectId: params.projectId });

  const { result } = await runOpenAiChatJsonEvaluation({
    model,
    systemContent: `You are AI member "${m.displayName?.trim() || "scm-manager"}" with orchestration role "scm-manager". Output only valid JSON.`,
    userMessage: `${userMessage}

[Output JSON only]
{
  "decision": "approve_merge" | "hold" | "reject",
  "summary": "Korean 2-5 sentences",
  "issues": ["..."]
}`,
  });

  const decisionRaw = String((result as any).decision ?? "").trim().toLowerCase();
  const decision: ScmManagerDecision =
    decisionRaw === "approve_merge" ? "approve_merge" : decisionRaw === "reject" ? "reject" : "hold";
  const summary = String((result as any).summary ?? result.reason ?? "").trim().slice(0, 6000);
  const issues = Array.isArray((result as any).issues)
    ? (result as any).issues.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 50)
    : [];
  const steps: ScmManagerStepRecord[] = [
    {
      memberId: m.id,
      name: m.displayName?.trim() || "scm-manager",
      role: "scm-manager",
      model,
      decision,
      summary,
      issues,
      reviewedAt: new Date().toISOString(),
    },
  ];
  return { decision, summary, steps };
}

