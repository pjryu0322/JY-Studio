import {
  buildFeaturePlanningV2ChatSystemPrompt,
  buildFeaturePlanningV2UserPromptFromBlocks,
  estimateTokensRough,
} from "@/lib/featurePlanning/buildFeaturePlanningPrompt";
import {
  mergeFeaturePlanningMemory,
  parsePlanningMemoryPatch,
} from "@/lib/featurePlanning/featurePlanningMemory";
import { recordFeaturePlanningOpenAi } from "@/lib/debug/promptTimelineStore";
import type { FeaturePlanningPromptMetricsV1 } from "@/lib/debug/promptTimelineTypes";
import { ensureFeaturePlanningQuestionSuffix } from "@/lib/featurePlanning/featurePlanningInteractiveBubble";
import { openAiChatJsonText, safeJsonParse } from "@/lib/featurePlanning/featurePlanningOpenAi";
import type { FeaturePlanningTopicV1 } from "@/lib/featurePlanning/featurePlanningTopic";
import { normalizePlanningTopicTransition, parsePlanningTopic } from "@/lib/featurePlanning/featurePlanningTopic";
import {
  mergePlannerArtifactPreservingLegacySlots,
  stripLegacyRoleSlotsFromNewInitializeArtifact,
} from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import {
  normalizeFeaturePlanningSlotType,
  parseFeaturePlanningSlotsArtifactV1,
  type FeaturePlanningSlotsArtifactV1,
} from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import {
  buildFeaturePlanningCompactBlocks,
  memorySnapshotForLog,
} from "@/lib/featurePlanning/summarizeFeaturePlanningContext";
import type { FeaturePlanningWorkspaceChatMessageV1 } from "@/lib/featurePlanning/featurePlanningWorkspaceChat";

export type FeaturePlanningPlannerTurnMetaV1 = {
  readonly newFeatureCandidates: readonly string[];
  readonly filledSlotsSummary: readonly string[];
  readonly nextQuestions: readonly string[];
};

export type FeaturePlanningChatLlmOk = {
  ok: true;
  artifact: FeaturePlanningSlotsArtifactV1;
  aiMessage: string;
  resultSummary: { title: string; lines: readonly string[] } | null;
  plannerMeta: FeaturePlanningPlannerTurnMetaV1;
  model: string;
};

export type FeaturePlanningChatLlmErr = { ok: false; code: string; message: string };

function composeTurnText(aiMessage: string, nextQuestions: readonly string[]): string {
  let body = aiMessage.trim();
  const qs = nextQuestions.map((q) => q.trim()).filter(Boolean).slice(0, 2);
  if (qs.length && !/\[질문\]/i.test(body)) {
    body += `\n\n[질문]\n${qs.join("\n")}`;
  }
  return body;
}

function buildResultSummary(changeSummary: string[]): { title: string; lines: readonly string[] } | null {
  const lines = changeSummary.filter(Boolean).slice(0, 12);
  if (!lines.length) return null;
  return { title: "기능 정리 반영", lines };
}

function parseNextQuestions(o: Record<string, unknown>): string[] {
  if (Array.isArray(o.nextQuestions)) {
    return o.nextQuestions.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 2);
  }
  const legacy = typeof o.nextQuestion === "string" ? o.nextQuestion.trim() : "";
  return legacy ? [legacy] : [];
}

function logChatTurn(
  projectId: string,
  input: {
    readonly model: string;
    readonly system: string;
    readonly user: string;
    readonly status: "SUCCESS" | "FAILED";
    readonly responseText?: string;
    readonly parsedJson?: string;
    readonly errorMessage?: string;
    readonly promptMetrics?: FeaturePlanningPromptMetricsV1 | null;
  }
): void {
  const pid = projectId.trim();
  if (!pid) return;
  recordFeaturePlanningOpenAi({
    projectId: pid,
    purpose: "FEATURE_PLANNING_CHAT",
    model: input.model,
    systemPrompt: input.system,
    userPrompt: input.user,
    status: input.status,
    responseText: input.responseText,
    parsedJson: input.parsedJson,
    errorMessage: input.errorMessage,
    promptMetrics: input.promptMetrics ?? null,
  });
}

export async function runFeaturePlanningChatLlm(input: {
  readonly projectId: string;
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly userMessage: string;
  readonly lastAssistantMessage?: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly requirementsStateJson: unknown;
  readonly workspaceMessages: readonly FeaturePlanningWorkspaceChatMessageV1[];
  readonly apiKey: string;
  readonly model: string;
}): Promise<FeaturePlanningChatLlmOk | FeaturePlanningChatLlmErr> {
  const pid = input.projectId.trim();
  const currentTopic: FeaturePlanningTopicV1 = input.artifact.planningTopic ?? "FEATURES";
  const system = buildFeaturePlanningV2ChatSystemPrompt();
  const compact = buildFeaturePlanningCompactBlocks({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    requirementsStateJson: input.requirementsStateJson,
    artifact: input.artifact,
    workspaceMessages: input.workspaceMessages,
    userMessage: input.userMessage,
    currentTopic,
    memory: input.artifact.planningMemoryV1,
    lastAssistantSnippet: input.lastAssistantMessage,
  });
  const user = buildFeaturePlanningV2UserPromptFromBlocks(compact);

  const res = await openAiChatJsonText(input.apiKey, input.model, system, user, { label: "기능 정리 플래너", skipTimeline: true });
  const metricsBase: FeaturePlanningPromptMetricsV1 = {
    tokenEstimateIn: estimateTokensRough(system.length + user.length),
    compressedContextSize: compact.compressedContextChars + compact.recentConversationChars,
    topic: currentTopic,
    memoryStateSnapshot: memorySnapshotForLog(input.artifact.planningMemoryV1),
  };

  if (!res.ok) {
    logChatTurn(pid, {
      model: input.model,
      system,
      user,
      status: "FAILED",
      responseText: undefined,
      errorMessage: `${res.code}: ${res.message}`,
      promptMetrics: metricsBase,
    });
    return res;
  }

  const root = safeJsonParse(res.text);
  if (!root || typeof root !== "object") {
    logChatTurn(pid, {
      model: input.model,
      system,
      user,
      status: "FAILED",
      responseText: res.text,
      errorMessage: "AI JSON 파싱에 실패했습니다.",
      promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(res.text.length) },
    });
    return { ok: false, code: "PARSE", message: "AI JSON 파싱에 실패했습니다." };
  }
  const o = root as Record<string, unknown>;
  const updatedSlots = o.updatedSlots;
  const recommendedOrder = Array.isArray(o.recommendedOrder)
    ? o.recommendedOrder.map((x) => String(x ?? "").trim()).filter(Boolean)
    : input.artifact.recommendedOrder;
  const nextVersion = Math.max(1, (input.artifact.version ?? 1) + 1);
  const now = new Date().toISOString();
  const artifactBase = parseFeaturePlanningSlotsArtifactV1({
    version: nextVersion,
    slots: updatedSlots,
    recommendedOrder,
    prototypeReadiness: o.prototypeReadiness ?? input.artifact.prototypeReadiness,
    updatedAt: now,
    generatedAt: input.artifact.generatedAt,
  });
  if (!artifactBase) {
    logChatTurn(pid, {
      model: input.model,
      system,
      user,
      status: "FAILED",
      responseText: res.text,
      errorMessage: "updatedSlots 스키마 오류",
      promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(res.text.length) },
    });
    return { ok: false, code: "SCHEMA", message: "기능 정리 AI 응답 형식이 올바르지 않습니다." };
  }

  let artifact: FeaturePlanningSlotsArtifactV1 = {
    ...artifactBase,
    planningTopic: currentTopic,
    planningMemoryV1: input.artifact.planningMemoryV1,
  };

  const aiMessage = typeof o.aiMessage === "string" ? o.aiMessage.trim() : "";
  const changeSummary = Array.isArray(o.changeSummary)
    ? o.changeSummary.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 12)
    : [];
  const nextQuestions = parseNextQuestions(o);
  const newFeatureCandidates = Array.isArray(o.newFeatureCandidates)
    ? o.newFeatureCandidates.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 8)
    : [];
  const filledSlotsSummary = Array.isArray(o.filledSlotsSummary)
    ? o.filledSlotsSummary.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 8)
    : [];

  if (!aiMessage) {
    logChatTurn(pid, {
      model: input.model,
      system,
      user,
      status: "FAILED",
      responseText: res.text,
      errorMessage: "aiMessage 비어 있음",
      promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(res.text.length) },
    });
    return { ok: false, code: "NO_MESSAGE", message: "aiMessage가 비어 있습니다." };
  }

  const normalizedSlots = artifact.slots.map((s) => ({
    ...s,
    slotType: normalizeFeaturePlanningSlotType(s.slotType),
  }));
  artifact = {
    ...artifact,
    slots: normalizedSlots,
    version: nextVersion,
    updatedAt: now,
    generatedAt: input.artifact.generatedAt ?? input.artifact.updatedAt,
    userEdited: false,
  };

  artifact = stripLegacyRoleSlotsFromNewInitializeArtifact(artifact, [
    ...(input.artifact.priorStepActorRoles ?? []),
    ...(artifact.priorStepActorRoles ?? []),
  ]);
  artifact = mergePlannerArtifactPreservingLegacySlots(input.artifact, artifact);

  const proposedTopic = parsePlanningTopic(o.planningTopic);
  const nextTopic = normalizePlanningTopicTransition(currentTopic, proposedTopic);

  const memPatch = parsePlanningMemoryPatch(o.planningMemory);
  let mem = mergeFeaturePlanningMemory(input.artifact.planningMemoryV1, memPatch);
  if (nextTopic !== currentTopic && currentTopic !== "DONE") {
    mem = mergeFeaturePlanningMemory(mem, {
      confirmedTopics: [currentTopic],
      pendingTopic: nextTopic,
    });
  }

  artifact = {
    ...artifact,
    planningTopic: nextTopic,
    planningMemoryV1: mem,
  };

  const resultSummary = buildResultSummary(changeSummary);
  const composed = ensureFeaturePlanningQuestionSuffix(composeTurnText(aiMessage, nextQuestions));

  let parsedForLog: string;
  try {
    parsedForLog = JSON.stringify(o).slice(0, 12_000);
  } catch {
    parsedForLog = "";
  }
  logChatTurn(pid, {
    model: input.model,
    system,
    user,
    status: "SUCCESS",
    responseText: res.text,
    parsedJson: parsedForLog || undefined,
    promptMetrics: {
      ...metricsBase,
      tokenEstimateOut: estimateTokensRough(res.text.length),
      topic: nextTopic,
      memoryStateSnapshot: memorySnapshotForLog(artifact.planningMemoryV1),
    },
  });

  return {
    ok: true,
    artifact,
    aiMessage: composed,
    resultSummary,
    plannerMeta: {
      newFeatureCandidates,
      filledSlotsSummary,
      nextQuestions,
    },
    model: input.model,
  };
}
