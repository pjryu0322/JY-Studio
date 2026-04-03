/**
 * Cursor 실행 결과 보고만으로 OpenAI JSON 평가.
 */

import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";
import type { EvalVerdict } from "@/lib/executionLoop/workflowConstants";

const DEFAULT_MODEL = "gpt-4o-mini";

export type TaskEvaluationResult = {
  decision: EvalVerdict;
  reason: string;
  /** 멀티 리뷰어 JSON의 issues[] (단일 평가에서도 채울 수 있음) */
  issues?: string[];
  score?: number;
  missingCriteria?: string[];
  suspiciousChanges?: string[];
};

export type OpenAiRelayEvalUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} | null;

export function parseOpenAiJsonText(text: string): Record<string, unknown> {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("invalid json");
  return parsed as Record<string, unknown>;
}

function parseJson(text: string): Record<string, unknown> {
  return parseOpenAiJsonText(text);
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const o = v.map((x) => String(x ?? "").trim()).filter(Boolean);
  return o.length ? o : undefined;
}

/** pass|fail|retry 및 레거시 done|failed|retry, summary|reason, issues */
export function parseOpenAiEvaluationJsonObject(o: Record<string, unknown>): {
  decision: EvalVerdict;
  reason: string;
  issues: string[];
  score?: number;
  missingCriteria?: string[];
  suspiciousChanges?: string[];
} {
  const passFail = String(o.result ?? "").toUpperCase().trim();
  let decision: EvalVerdict = "retry";
  if (passFail === "PASS") decision = "done";
  else if (passFail === "FAIL") decision = "failed";
  else {
    const raw = String(o.decision ?? o.verdict ?? "")
      .toLowerCase()
      .trim();
    if (raw === "done" || raw === "pass") decision = "done";
    else if (raw === "failed" || raw === "fail") decision = "failed";
    else if (raw === "retry") decision = "retry";
  }

  const reason = String(o.summary ?? o.reason ?? "").trim().slice(0, 2500) || "응답 없음";
  const issues = asStringArray(o.issues) ?? [];

  let score: number | undefined;
  if (typeof o.score === "number" && Number.isFinite(o.score)) score = o.score;

  return {
    decision,
    reason,
    issues,
    score,
    missingCriteria: asStringArray(o.missingCriteria),
    suspiciousChanges: asStringArray(o.suspiciousChanges),
  };
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
  "decision": "pass" | "retry" | "fail" (또는 레거시 "done" | "retry" | "failed"),
  "summary": "한국어 2~5문장",
  "issues": ["구체적 지적", "..."] (없으면 []),
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
  let issues: string[] | undefined;
  let score: number | undefined;
  let missingCriteria: string[] | undefined;
  let suspiciousChanges: string[] | undefined;
  try {
    const o = parseJson(text);
    const p = parseOpenAiEvaluationJsonObject(o);
    decision = p.decision;
    reason = p.reason;
    issues = p.issues.length ? p.issues : undefined;
    score = p.score;
    missingCriteria = p.missingCriteria;
    suspiciousChanges = p.suspiciousChanges;
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

  return { result: { decision, reason, issues, score, missingCriteria, suspiciousChanges }, usage };
}

/** 임의 모델·사용자 메시지로 동일 JSON 스키마 평가(멀티 리뷰어용). */
export async function runOpenAiChatJsonEvaluation(params: {
  model: string;
  systemContent: string;
  userMessage: string;
  /** 기본 0.15 — ENV_TEST Stage 2 등에서 더 낮게 지정 가능 */
  temperature?: number;
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

  const model = params.model.trim() || DEFAULT_MODEL;
  const temperature = typeof params.temperature === "number" && Number.isFinite(params.temperature) ? params.temperature : 0.15;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.systemContent },
        { role: "user", content: params.userMessage },
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
  let issues: string[] | undefined;
  let score: number | undefined;
  let missingCriteria: string[] | undefined;
  let suspiciousChanges: string[] | undefined;
  try {
    const o = parseJson(text);
    const p = parseOpenAiEvaluationJsonObject(o);
    decision = p.decision;
    reason = p.reason;
    issues = p.issues.length ? p.issues : undefined;
    score = p.score;
    missingCriteria = p.missingCriteria;
    suspiciousChanges = p.suspiciousChanges;
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

  return { result: { decision, reason, issues, score, missingCriteria, suspiciousChanges }, usage };
}
