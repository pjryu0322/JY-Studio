/**
 * Overlay: **Review Harness** — Cursor 실행 **이후** OpenAI 기반 JSON 리뷰를 멤버 순으로 수행.
 * 내부 단계(의미만 분리, 동작 동일):
 * 1) member selection — `projectMember` 조회·정렬
 * 2) context build — `buildCommonContext` + 역할별 user 메시지
 * 3) model execution — `runOpenAiChatJsonEvaluation` 루프
 * 4) result aggregation — `aggregateExecutionReviewDecisions` + usage 합산
 * Stage1/2·Cursor launch·GitHub 자동화와 분리된 **리뷰 전용** 경로.
 */
import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";
import {
  runOpenAiChatJsonEvaluation,
  type OpenAiRelayEvalUsage,
  type TaskEvaluationResult,
} from "@/lib/execution/openAiRelayEvaluation";
import {
  aggregateExecutionReviewDecisions,
  type AiMemberRole,
  EXECUTION_REVIEW_ROLE_ORDER,
  type ExecutionReviewDecision,
  resolveEffectiveReviewerModel,
  roleOrderIndex,
} from "@/lib/ai-member/aiMemberOrchestration";
import { prisma } from "@/lib/prisma";

export type ExecutionReviewerStepRecord = {
  memberId: string;
  name: string;
  role: string;
  model: string;
  decision: ExecutionReviewDecision;
  summary: string;
  issues: string[];
  reviewedAt: string;
};

function buildCommonContext(params: {
  task: { title: string; description: string | null; acceptanceCriteria: string[] };
  cursorResult: CursorRunResult;
  repoUrl: string;
  stopOnTestFailure: boolean;
  /** GitHub compare 기반: push된 실제 변경 증거 */
  gitEvidence?: {
    baseBranch: string;
    headBranch: string;
    headSha: string | null;
    changedFiles: string[];
    diffSummary: string;
  } | null;
}): string {
  const criteria = params.task.acceptanceCriteria.length
    ? params.task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")
    : "(수용 기준 없음 — 설명만으로 판단)";
  const cr = params.cursorResult;
  const ge = params.gitEvidence;
  const gitSection = ge
    ? `
[Git 증거(실제 push된 변경분, GitHub API compare 기반)]
- base: ${ge.baseBranch}
- head(branch): ${ge.headBranch}
- headSha: ${ge.headSha ?? "(없음)"}

[변경 파일 목록(실측)]
${ge.changedFiles.length ? ge.changedFiles.join("\n") : "(없음)"}

[diff 요약/patch 일부(실측)]
${ge.diffSummary.slice(0, 18_000)}
`
    : "";

  return `오케스트레이션 플랫폼의 검토자다. 실행은 Cursor(원격)가 수행했고, 아래는 Cursor의 **보고** + GitHub의 **실제 변경 증거**다.
플랫폼은 저장소를 클론하거나 git을 실행하지 않는다(원격 API 기반).

[대상 저장소 URL]
${params.repoUrl}

[Task 제목]
${params.task.title}

[Task 설명]
${params.task.description ?? "(없음)"}

[수용 기준]
${criteria}

[Cursor runId]
${cr.runId}

[보고된 브랜치]
${cr.branchName}

[보고된 커밋 해시]
${cr.commitHash ?? "(없음)"}

[변경 파일 목록]
${cr.changedFiles.length ? cr.changedFiles.join("\n") : "(없음)"}

[실행 요약 / 로그 성격의 본문]
${cr.summary.slice(0, 14_000)}

${gitSection}

[공통 정책]
- 출력은 반드시 JSON 한 객체만.
- decision은 "pass" | "retry" | "fail" (레거시로 done/retry/failed 도 허용).
- summary는 한국어 2~5문장.
- issues는 문자열 배열(구체적 지적; 없으면 []).
${params.stopOnTestFailure ? "- 테스트/빌드 실패가 요약에 분명하면 fail.\n" : ""}`;
}

function roleSpecificInstructions(role: AiMemberRole): string {
  switch (role) {
    case "reviewer":
      return `[이번 단계 역할: 실행 리뷰어]
- 요구사항(수용 기준) 충족 여부를 검토한다.
- 변경 파일이 과제와 관련 있는지, 불필요한 변경이 많은지 본다.
- 모호하거나 무관한 대규모 변경이면 fail 또는 retry.`;
    case "security-reviewer":
      return `[이번 단계 역할: 보안 리뷰어]
- 인증·인가 및 보안 위험을 검토한다.
- 시크릿·토큰·키 노출이 보이면 fail.
- 주입·위험한 시스템 호출·임의 실행 등을 issues에 적는다.`;
    case "quality-reviewer":
      return `[이번 단계 역할: 품질 리뷰어]
- 구조·테스트·유지보수성을 검토한다.
- 치명적이지 않으면 pass를 줄 수 있으나 개선점은 issues에 적는다.`;
    case "spec-reviewer":
      return `[이번 단계 역할: 스펙 리뷰어]
- 스펙/요구 정합성·누락을 검토하고 issues에 적는다.`;
    case "task-reviewer":
      return `[이번 단계 역할: 태스크 리뷰어]
- 태스크 목표 대비 산출 충분 여부를 검토한다.`;
    default:
      return `[이번 단계 역할: ${role}]`;
  }
}

function buildUserMessageForRole(
  role: AiMemberRole,
  base: ReturnType<typeof buildCommonContext>
): string {
  return `${base}

${roleSpecificInstructions(role)}

[출력 JSON만]
{
  "decision": "pass" | "retry" | "fail",
  "summary": "한국어 2~5문장",
  "issues": ["구체적 지적", "..."]
}`;
}

/** Review Harness — member selection (count). execution-review 스테이지 AI 멤버 수. */
export async function countExecutionReviewAiMembers(projectId: string): Promise<number> {
  return prisma.projectMember.count({
    where: {
      projectId,
      memberType: "AI",
      orchestrationEnabled: true,
      orchestrationStage: "execution-review",
      aiOrchestrationRole: { in: [...EXECUTION_REVIEW_ROLE_ORDER] },
    },
  });
}

/** Review Harness — member selection + context + model loop + aggregation. */
export async function tryRunExecutionReviewWithAiMembers(params: {
  projectId: string;
  task: {
    title: string;
    description: string | null;
    acceptanceCriteria: string[];
  };
  cursorResult: CursorRunResult;
  repoUrl: string;
  stopOnTestFailure: boolean;
  gitEvidence?: {
    baseBranch: string;
    headBranch: string;
    headSha: string | null;
    changedFiles: string[];
    diffSummary: string;
  } | null;
}): Promise<{
  result: TaskEvaluationResult;
  usage: OpenAiRelayEvalUsage;
  steps: ExecutionReviewerStepRecord[];
} | null> {
  // Review Harness — 1) member selection
  const rows = await prisma.projectMember.findMany({
    where: {
      projectId: params.projectId,
      memberType: "AI",
      orchestrationEnabled: true,
      orchestrationStage: "execution-review",
      aiOrchestrationRole: { in: [...EXECUTION_REVIEW_ROLE_ORDER] },
    },
    select: {
      id: true,
      displayName: true,
      aiOrchestrationRole: true,
      aiModelOverride: true,
    },
  });

  const members = rows
    .map((r) => {
      const role = r.aiOrchestrationRole as AiMemberRole | null;
      if (!role) return null;
      return {
        id: r.id,
        name: r.displayName?.trim() || role,
        role,
        model: resolveEffectiveReviewerModel(role, r.aiModelOverride),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => {
      const oa = roleOrderIndex(a.role);
      const ob = roleOrderIndex(b.role);
      if (oa !== ob) return oa - ob;
      return a.id.localeCompare(b.id);
    });

  if (members.length === 0) {
    return null;
  }

  // Review Harness — 2) context build (shared + per-role user message inside loop)
  const baseContext = buildCommonContext(params);
  const steps: ExecutionReviewerStepRecord[] = [];
  const decisions: ExecutionReviewDecision[] = [];
  let totalUsage: NonNullable<OpenAiRelayEvalUsage> | null = null;

  // Review Harness — 3) model execution
  for (const m of members) {
    const userMessage = buildUserMessageForRole(m.role, baseContext);
    const { result, usage } = await runOpenAiChatJsonEvaluation({
      model: m.model,
      systemContent: `You are AI member "${m.name}" with orchestration role "${m.role}". Output only valid JSON.`,
      userMessage,
    });

    const decision = result.decision as ExecutionReviewDecision;
    decisions.push(decision);
    const issues = (result.issues ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 50);
    steps.push({
      memberId: m.id,
      name: m.name,
      role: m.role,
      model: m.model,
      decision,
      summary: result.reason.slice(0, 4000),
      issues,
      reviewedAt: new Date().toISOString(),
    });

    if (usage) {
      totalUsage = totalUsage
        ? {
            promptTokens: totalUsage.promptTokens + usage.promptTokens,
            completionTokens: totalUsage.completionTokens + usage.completionTokens,
            totalTokens: totalUsage.totalTokens + usage.totalTokens,
          }
        : { ...usage };
    }
  }

  // Review Harness — 4) result aggregation
  const finalDecision = aggregateExecutionReviewDecisions(decisions);
  const reason = steps
    .map((s) => `[${s.name}·${s.role}·${s.model}] ${s.decision}: ${s.summary}`)
    .join("\n---\n")
    .slice(0, 8000);

  return {
    result: {
      decision: finalDecision,
      reason,
      suspiciousChanges: steps.flatMap((s) => (s.decision === "failed" ? [`${s.role}_failed`] : [])),
    },
    usage: totalUsage,
    steps,
  };
}
