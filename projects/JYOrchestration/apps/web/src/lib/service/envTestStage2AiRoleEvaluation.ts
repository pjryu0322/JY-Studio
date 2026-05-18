import { runOpenAiChatJsonEvaluation, type OpenAiRelayEvalUsage } from "@/lib/execution/openAiRelayEvaluation";
import {
  ENV_TEST_STAGE2_OPENAI_TEMPERATURE,
  resolveEnvTestStage2OpenAiModel,
} from "@/lib/service/envTestStage2OpenAiConfig";
import {
  type ReviewerToPlatformResultPayload,
  type SecurityToPlatformResultPayload,
  type PlatformToReviewerRequestPayload,
  type PlatformToSecurityRequestPayload,
  type ExecutorToPlatformStatusPayload,
  type Stage2RoleOutcome,
} from "@/lib/service/envTestStage2Messages";
import { getAiMemberByRole } from "@/lib/service/envTestStage2AiMemberLookup";
import { tryRunScmManagerWithAiMembers, type ScmManagerDecision } from "@/lib/execution/scmManagerWithAiMembers";
import {
  appendStage2EventToTiming,
  logStage2TelemetryEvent,
  type EnvTestStage2TimingRecord,
} from "@/lib/service/envTestStage2Telemetry";

function maskSecretsForPrompt(raw: string): string {
  const t = String(raw ?? "");
  return t
    .replace(/\bghp_[A-Za-z0-9]{8,}\b/g, (m) => `${m.slice(0, 4)}****${m.slice(-4)}`)
    .replace(/\bgithub_pat_[A-Za-z0-9]{8,}\b/g, (m) => `${m.slice(0, 4)}****${m.slice(-4)}`)
    .replace(/\bsk-[A-Za-z0-9]{8,}\b/g, (m) => `${m.slice(0, 3)}****${m.slice(-3)}`)
    .slice(0, 1200);
}

function passFailFromEvalDecision(decision: string): "PASS" | "FAIL" {
  const d = String(decision ?? "").toLowerCase().trim();
  if (d === "done" || d === "pass") return "PASS";
  return "FAIL";
}

function parseReason(result: { reason?: string }): string {
  const r = String(result?.reason ?? "").trim();
  return r ? r.slice(0, 450) : "reason_not_provided";
}

export async function runEnvTestStage2ExecutorOpenAiAck(input: {
  projectId: string;
  taskId: string;
  execRunId: string;
  actorUserId: string;
}): Promise<{
  ok: boolean;
  elapsedMs: number;
  payload: ExecutorToPlatformStatusPayload;
  usage: OpenAiRelayEvalUsage;
  timing: EnvTestStage2TimingRecord;
}> {
  const executionId = input.execRunId;
  const start = Date.now();
  const startIso = new Date(start).toISOString();
  await getAiMemberByRole({ projectId: input.projectId, role: "executor" });
  const model = resolveEnvTestStage2OpenAiModel();
  const { result, usage } = await runOpenAiChatJsonEvaluation({
    model,
    temperature: ENV_TEST_STAGE2_OPENAI_TEMPERATURE,
    maxCompletionTokens: 80,
    systemContent: `ENV_TEST Stage2 executor ack. Reply JSON only: {"result":"PASS"|"FAIL","reason":"short"}`,
    userMessage: '{"type":"EXECUTE_ENV_TEST_STAGE2","mode":"ENV_TEST_STAGE2"}',
  });
  const end = Date.now();
  const endIso = new Date(end).toISOString();
  const elapsedMs = end - start;
  const ok = passFailFromEvalDecision(result.decision) === "PASS";
  const payload: ExecutorToPlatformStatusPayload = {
    type: "EXECUTOR_STATUS",
    status: ok ? "STARTED" : "RUNNING",
  };
  const ev = {
    event: "EXECUTOR_OPENAI_ACK",
    stage: "EXECUTOR" as const,
    executionId,
    startTime: startIso,
    endTime: endIso,
    elapsedMs,
    result: ok ? "ok" : "retry",
  };
  logStage2TelemetryEvent({
    ...ev,
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
  });
  const timing: EnvTestStage2TimingRecord = appendStage2EventToTiming(
    { executionId, executorTimeMs: elapsedMs },
    ev
  );
  return { ok, elapsedMs, payload, usage, timing };
}

export async function runEnvTestStage2ReviewerWithAiMember(
  input: {
    projectId: string;
    request: PlatformToReviewerRequestPayload;
  },
  opts?: { enableMasking?: boolean }
): Promise<ReviewerToPlatformResultPayload> {
  const member = await getAiMemberByRole({ projectId: input.projectId, role: "reviewer" });
  if (!member.available) {
    const reason =
      member.unavailableReason === "disabled"
        ? "review disabled: Reviewer 멤버가 비활성화되어 있습니다."
        : "review member missing: 등록된 Reviewer AI 멤버가 없습니다.";
    return {
      type: "REVIEW_RESULT",
      result: member.unavailableReason === "disabled" ? "DISABLED" : "MISSING",
      reason,
    };
  }

  const maskedDiff = opts?.enableMasking === false ? input.request.diffSummary : maskSecretsForPrompt(input.request.diffSummary);
  const userPayload = {
    files: input.request.changedFiles.slice(0, 8),
    diff: maskedDiff,
  };

  const model = resolveEnvTestStage2OpenAiModel();
  const { result } = await runOpenAiChatJsonEvaluation({
    model,
    temperature: ENV_TEST_STAGE2_OPENAI_TEMPERATURE,
    maxCompletionTokens: 96,
    systemContent: `Stage2 smoke reviewer. JSON only: {"result":"PASS"|"FAIL","reason":"short"}. Whitelist paths only.`,
    userMessage: JSON.stringify(userPayload),
  });

  const passFail = passFailFromEvalDecision(result.decision);
  return { type: "REVIEW_RESULT", result: passFail, reason: parseReason(result) };
}

export async function runEnvTestStage2SecurityWithAiMember(
  input: {
    projectId: string;
    request: PlatformToSecurityRequestPayload;
  },
  opts?: { enableMasking?: boolean }
): Promise<SecurityToPlatformResultPayload> {
  const member = await getAiMemberByRole({ projectId: input.projectId, role: "security" });
  if (!member.available) {
    const reason =
      member.unavailableReason === "disabled"
        ? "security disabled: Security 멤버가 비활성화되어 있습니다."
        : "security member missing: 등록된 Security AI 멤버가 없습니다.";
    return {
      type: "SECURITY_RESULT",
      result: member.unavailableReason === "disabled" ? "DISABLED" : "MISSING",
      reason,
    };
  }

  const maskedDiff = opts?.enableMasking === false ? input.request.diffSummary : maskSecretsForPrompt(input.request.diffSummary);
  const userPayload = {
    files: input.request.changedFiles.slice(0, 8),
    diff: maskedDiff,
  };

  const model = resolveEnvTestStage2OpenAiModel();
  const { result } = await runOpenAiChatJsonEvaluation({
    model,
    temperature: ENV_TEST_STAGE2_OPENAI_TEMPERATURE,
    maxCompletionTokens: 96,
    systemContent: `Stage2 smoke security. JSON only: {"result":"PASS"|"FAIL","reason":"short"}. Obvious secrets=FAIL.`,
    userMessage: JSON.stringify(userPayload),
  });

  const passFail = passFailFromEvalDecision(result.decision);
  return { type: "SECURITY_RESULT", result: passFail, reason: parseReason(result) };
}

export async function runEnvTestStage2ScmDecisionWithAiMembers(input: {
  projectId: string;
  repoUrl: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string | null;
  branch: string;
  baseBranch: string;
  reviewResult: Stage2RoleOutcome;
  securityResult: Stage2RoleOutcome;
  reviewReason: string | null;
  securityReason: string | null;
}): Promise<{ available: boolean; decision: ScmManagerDecision | null; summary: string | null }> {
  const member = await getAiMemberByRole({ projectId: input.projectId, role: "scm" });
  if (!member.available) {
    return { available: false, decision: null, summary: null };
  }

  const reviewDecision =
    input.reviewResult === "PASS" && input.securityResult === "PASS" ? "PASS" : "FAIL";
  const reviewSummary = [
    `reviewResult=${input.reviewResult}`,
    `securityResult=${input.securityResult}`,
    input.reviewReason ? `reviewReason=${input.reviewReason}` : null,
    input.securityReason ? `securityReason=${input.securityReason}` : null,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 400);

  const pack = await tryRunScmManagerWithAiMembers({
    projectId: input.projectId,
    repoUrl: input.repoUrl,
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    taskDescription: input.taskDescription,
    branch: input.branch,
    baseBranch: input.baseBranch,
    reviewerDecision: reviewDecision,
    reviewerSummary: reviewSummary,
    openAiModelOverride: resolveEnvTestStage2OpenAiModel(),
    openAiTemperature: ENV_TEST_STAGE2_OPENAI_TEMPERATURE,
  });

  if (!pack) return { available: true, decision: null, summary: null };
  return { available: true, decision: pack.decision, summary: pack.summary };
}
