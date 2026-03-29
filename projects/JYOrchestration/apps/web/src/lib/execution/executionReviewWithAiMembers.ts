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
  roleOrderIndex,
} from "@/lib/ai-member/aiMemberOrchestration";
import { prisma } from "@/lib/prisma";

const DEFAULT_MODEL = "gpt-4o-mini";

export type ExecutionReviewerStepRecord = {
  memberId: string;
  name: string;
  role: string;
  model: string;
  decision: ExecutionReviewDecision;
  summary: string;
  reviewedAt: string;
};

function envDefaultModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

function buildCommonContext(params: {
  task: { title: string; description: string | null; acceptanceCriteria: string[] };
  cursorResult: CursorRunResult;
  repoUrl: string;
  stopOnTestFailure: boolean;
}): string {
  const criteria = params.task.acceptanceCriteria.length
    ? params.task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")
    : "(수용 기준 없음 — 설명만으로 판단)";
  const cr = params.cursorResult;
  return `오케스트레이션 플랫폼의 검토자다. 실행은 Cursor(원격)가 수행했고, 아래는 그 **보고 결과**뿐이다.
플랫폼은 저장소를 클론하거나 git을 실행하지 않는다.

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

[공통 정책]
- 출력은 반드시 JSON 한 객체만.
- decision은 "done" | "retry" | "failed" 중 하나.
- reason은 한국어 2~5문장.
${params.stopOnTestFailure ? "- 테스트/빌드 실패가 요약에 분명하면 failed.\n" : ""}`;
}

function roleSpecificInstructions(role: AiMemberRole): string {
  switch (role) {
    case "reviewer":
      return `[이번 단계 역할: 실행 리뷰어]
- 수용 기준이 변경·요약과 어떻게 맞는지 평가한다.
- 변경 파일이 과제와 관련 있는지, 불필요한 변경이 많은지 본다.
- 모호하거나 무관한 대규모 변경이면 failed 또는 retry.`;
    case "security-reviewer":
      return `[이번 단계 역할: 보안 리뷰어]
- 인증/인가·데이터 노출·주입·위험한 시스템 호출을 중심으로 본다.
- 시크릿·토큰·키·비밀번호 패턴이 노출된 것처럼 보이면 failed.
- 위험한 코드 경로(임의 실행, 셸 호출 등)를 지적한다.`;
    case "quality-reviewer":
      return `[이번 단계 역할: 품질 리뷰어]
- 리팩터링 필요성, 테스트·문서 공백, 유지보수성을 본다.
- 치명적이지 않으면 done을 줄 수 있으나 개선점은 reason에 적는다.`;
    case "spec-reviewer":
      return `[이번 단계 역할: 스펙 리뷰어]
- 스펙/요구와의 정합성, 누락된 요구를 본다.`;
    case "task-reviewer":
      return `[이번 단계 역할: 태스크 리뷰어]
- 태스크 목표 대비 산출이 충분한지 본다.`;
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
  "decision": "done" | "retry" | "failed",
  "reason": "한국어 2~5문장",
  "score": 0-100 optional,
  "missingCriteria": ["..."] optional,
  "suspiciousChanges": ["..."] optional
}`;
}

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
}): Promise<{
  result: TaskEvaluationResult;
  usage: OpenAiRelayEvalUsage;
  steps: ExecutionReviewerStepRecord[];
} | null> {
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
        model: (r.aiModelOverride?.trim() || envDefaultModel()).trim(),
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

  const baseContext = buildCommonContext(params);
  const steps: ExecutionReviewerStepRecord[] = [];
  const decisions: ExecutionReviewDecision[] = [];
  let totalUsage: NonNullable<OpenAiRelayEvalUsage> | null = null;

  for (const m of members) {
    const userMessage = buildUserMessageForRole(m.role, baseContext);
    const { result, usage } = await runOpenAiChatJsonEvaluation({
      model: m.model,
      systemContent: `You are AI member "${m.name}" with orchestration role "${m.role}". Output only valid JSON.`,
      userMessage,
    });

    const decision = result.decision as ExecutionReviewDecision;
    decisions.push(decision);
    steps.push({
      memberId: m.id,
      name: m.name,
      role: m.role,
      model: m.model,
      decision,
      summary: result.reason.slice(0, 4000),
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
