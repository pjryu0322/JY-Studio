/**
 * 릴레이 모드: Cursor 보고 결과만으로 OpenAI JSON 평가.
 */

import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";
import type { EvalVerdict } from "@/lib/executionLoop/workflowConstants";

const DEFAULT_MODEL = "gpt-4o-mini";

export type TaskEvaluationResult = {
  decision: EvalVerdict;
  reason: string;
  score?: number;
  missingCriteria?: string[];
  suspiciousChanges?: string[];
};

export type OpenAiRelayEvalUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} | null;

function parseJson(text: string): Record<string, unknown> {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("invalid json");
  return parsed as Record<string, unknown>;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const o = v.map((x) => String(x ?? "").trim()).filter(Boolean);
  return o.length ? o : undefined;
}

export function relaySummaryLooksLikeFailure(summary: string, cursor: CursorRunResult): boolean {
  if (cursor.executionStatus === "failed") return true;
  const s = summary.toLowerCase();
  return (
    /\b(test fail|tests failed|failing tests|npm err|error ts\d+|build failed|ci failed)\b/.test(s) ||
    /\bexit code [1-9]\d*\b/.test(s)
  );
}

export async function runOpenAiRelayEvaluation(params: {
  task: {
    title: string;
    description: string | null;
    acceptanceCriteria: string[];
  };
  cursorResult: CursorRunResult;
  repoUrl: string;
  stopOnTestFailure: boolean;
}): Promise<{ result: TaskEvaluationResult; usage: OpenAiRelayEvalUsage }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      result: {
        decision: "retry",
        reason: "OPENAI_API_KEY 없음 — 평가 생략(retry)",
      },
      usage: null,
    };
  }
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  const criteria = params.task.acceptanceCriteria.length
    ? params.task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")
    : "(수용 기준 없음 — 설명만으로 판단)";

  const cr = params.cursorResult;
  const userMessage = `오케스트레이션 플랫폼의 검토자다. 실행은 Cursor(원격)가 수행했고, 아래는 그 **보고 결과**뿐이다.
플랫폼은 저장소를 클론하거나 git을 실행하지 않는다. GitHub의 실제 코드는 저장소 URL 기준으로만 신뢰할 수 있다.

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

[정책]
- 수용 기준 미충족 → retry 또는 failed.
- 요약이 모호하거나 변경 파일이 과제와 무관해 보이면 failed 또는 retry.
- 무관한 대규모 변경·시크릿 노출 언급 → failed.
${params.stopOnTestFailure ? "- 테스트/빌드 실패가 요약에 분명하면 failed." : ""}

[출력 JSON만]
{
  "decision": "done" | "retry" | "failed",
  "reason": "한국어 2~5문장",
  "score": 0-100 optional,
  "missingCriteria": ["..."] optional,
  "suspiciousChanges": ["..."] optional
}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a strict reviewer. Output only valid JSON.",
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return {
      result: {
        decision: "retry",
        reason: `OpenAI HTTP ${res.status}: ${t.slice(0, 200)}`,
      },
      usage: null,
    };
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return { result: { decision: "retry", reason: "빈 OpenAI 응답" }, usage: null };
  }

  let decision: EvalVerdict = "retry";
  let reason = text;
  let score: number | undefined;
  let missingCriteria: string[] | undefined;
  let suspiciousChanges: string[] | undefined;
  try {
    const o = parseJson(text);
    const d = String(o.decision ?? o.verdict ?? "")
      .toLowerCase()
      .trim();
    if (d === "done" || d === "failed" || d === "retry") decision = d;
    reason = String(o.reason ?? o.summary ?? reason).slice(0, 2500);
    if (typeof o.score === "number" && Number.isFinite(o.score)) score = o.score;
    missingCriteria = asStringArray(o.missingCriteria);
    suspiciousChanges = asStringArray(o.suspiciousChanges);
  } catch {
    reason = text.slice(0, 2000);
  }

  const u = body.usage;
  const usage =
    typeof u?.prompt_tokens === "number" &&
    typeof u?.completion_tokens === "number" &&
    typeof u?.total_tokens === "number"
      ? {
          promptTokens: u.prompt_tokens,
          completionTokens: u.completion_tokens,
          totalTokens: u.total_tokens,
        }
      : null;

  return { result: { decision, reason, score, missingCriteria, suspiciousChanges }, usage };
}
