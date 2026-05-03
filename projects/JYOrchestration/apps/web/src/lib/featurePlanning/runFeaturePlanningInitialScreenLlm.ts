import { randomUUID } from "node:crypto";
import type { FeaturePlanningSlotsLlmContext } from "@/lib/featurePlanning/buildFeaturePlanningSlotsContext";
import {
  buildFeaturePlanningFlowEntryAnalyzeSystemPrompt,
  buildFeaturePlanningV2InitSystemPrompt,
  buildFeaturePlanningV2UserPromptFromBlocks,
  estimateTokensRough,
} from "@/lib/featurePlanning/buildFeaturePlanningPrompt";
import type { FeaturePlanningPromptPurpose } from "@/lib/debug/featurePlanningPromptPurpose";
import {
  defaultFeaturePlanningMemory,
  mergeFeaturePlanningMemory,
  parsePlanningMemoryPatch,
} from "@/lib/featurePlanning/featurePlanningMemory";
import { recordFeaturePlanningOpenAi } from "@/lib/debug/promptTimelineStore";
import type { FeaturePlanningPromptMetricsV1 } from "@/lib/debug/promptTimelineTypes";
import { openAiChatJsonText, safeJsonParse } from "@/lib/featurePlanning/featurePlanningOpenAi";
import { stripLegacyRoleSlotsFromNewInitializeArtifact } from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import { sanitizeFeaturePlanningUserVisibleKorean } from "@/lib/featurePlanning/featurePlanningUserVisibleSanitize";
import type { FeaturePlanningWorkspaceChatMessageV1 } from "@/lib/featurePlanning/featurePlanningWorkspaceChat";
import type { FeaturePlanningTopicV1 } from "@/lib/featurePlanning/featurePlanningTopic";
import {
  parseFeaturePlanningSlotsArtifactV1,
  type FeaturePlanningSlotsArtifactV1,
} from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import {
  buildFeaturePlanningCompactBlocks,
  memorySnapshotForLog,
} from "@/lib/featurePlanning/summarizeFeaturePlanningContext";

export type FeaturePlanningInitialScreenMode = "create" | "chat_reseed";

export type FeaturePlanningInitialScreenOk = {
  readonly ok: true;
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly aiMessage: FeaturePlanningWorkspaceChatMessageV1;
  readonly model: string;
};

export type FeaturePlanningInitialScreenErr = { readonly ok: false; readonly code: string; readonly message: string };

/** LLM이 채팅 스키마(updatedSlots)로만 돌려주는 경우 호환 */
function readSlotsFromInitResponse(o: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(o.slots) && o.slots.length) return o.slots;
  if (Array.isArray(o.updatedSlots) && o.updatedSlots.length) return o.updatedSlots;
  return null;
}

function logInit(
  projectId: string,
  purpose: FeaturePlanningPromptPurpose,
  model: string,
  system: string,
  user: string,
  status: "SUCCESS" | "FAILED",
  input: {
    readonly responseText?: string;
    readonly parsedJson?: string;
    readonly errorMessage?: string;
    readonly promptMetrics?: FeaturePlanningPromptMetricsV1 | null;
  }
): void {
  recordFeaturePlanningOpenAi({
    projectId,
    purpose,
    model,
    systemPrompt: system,
    userPrompt: user,
    status,
    responseText: input.responseText,
    parsedJson: input.parsedJson,
    errorMessage: input.errorMessage,
    promptMetrics: input.promptMetrics ?? null,
  });
}

export async function runFeaturePlanningInitialScreenLlm(input: {
  readonly projectId: string;
  readonly ctx: FeaturePlanningSlotsLlmContext;
  /** v2 압축 요약용 — 원문 아이디어/흐름 JSON은 프롬프트에 넣지 않는다 */
  readonly requirementsStateJson: unknown;
  readonly apiKey: string;
  readonly model: string;
  readonly mode: FeaturePlanningInitialScreenMode;
  readonly existingArtifact?: FeaturePlanningSlotsArtifactV1 | null;
  readonly forceRegenerate?: boolean;
  /** 타임라인 구분(기본 INIT) */
  readonly promptPurpose?: FeaturePlanningPromptPurpose;
  /** 서비스 흐름 확정 후 첫 진입용 message 형식 */
  readonly entryMessageFormat?: "default" | "flow_entry";
  /** flow_entry 시 message 2번째 줄에 넣을 단계명 */
  readonly firstStepTitle?: string;
}): Promise<FeaturePlanningInitialScreenOk | FeaturePlanningInitialScreenErr> {
  const projectId = input.projectId.trim();
  const purpose = input.promptPurpose ?? "FEATURE_PLANNING_INIT";
  const entryFmt = input.entryMessageFormat ?? "flow_entry";
  const stepTitle = (input.firstStepTitle ?? "서비스").trim().slice(0, 120);
  const stateLine =
    input.mode === "chat_reseed"
      ? "[필수] 최상위 키 slots 배열로 반환(updatedSlots 금지). 저장된 슬롯을 그대로 복사한 뒤 message·nextQuestion만 새로 쓰세요. 대화만 비어 있는 재시드입니다."
      : input.forceRegenerate
        ? "기능 정리 초안 다시 만들기 — 이전 단계 결과를 바탕으로 슬롯과 첫 대화를 새로 구성합니다."
        : "초기 진입";

  const artifactForPrompt =
    input.mode === "chat_reseed" ? input.existingArtifact ?? null
    : input.forceRegenerate && input.existingArtifact ? input.existingArtifact
    : null;

  const system =
    entryFmt === "flow_entry" ? buildFeaturePlanningFlowEntryAnalyzeSystemPrompt() : buildFeaturePlanningV2InitSystemPrompt();
  const stateLineForUser =
    entryFmt === "flow_entry" ? `${stateLine}\n\n[정리 우선 단계]\n${stepTitle}` : stateLine;
  const compact = buildFeaturePlanningCompactBlocks({
    projectName: input.ctx.projectName,
    projectDescription: input.ctx.projectDescription,
    requirementsStateJson: input.requirementsStateJson,
    artifact: artifactForPrompt,
    workspaceMessages: [],
    userMessage: stateLineForUser.slice(0, 400),
    currentTopic: "FEATURES",
    memory: artifactForPrompt?.planningMemoryV1 ?? defaultFeaturePlanningMemory(),
  });
  const user = buildFeaturePlanningV2UserPromptFromBlocks(compact);
  const metricsBase: FeaturePlanningPromptMetricsV1 = {
    tokenEstimateIn: estimateTokensRough(system.length + user.length),
    compressedContextSize: compact.compressedContextChars + compact.recentConversationChars,
    topic: "FEATURES",
    memoryStateSnapshot: memorySnapshotForLog(artifactForPrompt?.planningMemoryV1),
  };

  const res = await openAiChatJsonText(input.apiKey, input.model, system, user, {
    label: "기능정리 초기 화면",
    skipTimeline: true,
    temperature: 0.28,
  });
  if (!res.ok) {
    logInit(projectId, purpose, input.model, system, user, "FAILED", {
      errorMessage: `${res.code}: ${res.message}`,
      promptMetrics: metricsBase,
    });
    return { ok: false, code: res.code, message: res.message };
  }

  const root = safeJsonParse(res.text);
  if (!root || typeof root !== "object") {
    logInit(projectId, purpose, input.model, system, user, "FAILED", {
      responseText: res.text,
      errorMessage: "JSON 파싱 실패",
      promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(res.text.length) },
    });
    return { ok: false, code: "PARSE", message: "AI JSON 파싱에 실패했습니다." };
  }
  const o = root as Record<string, unknown>;
  const messageRaw = typeof o.message === "string" ? o.message.trim() : "";
  const nextQuestion = typeof o.nextQuestion === "string" ? o.nextQuestion.trim() : "";
  if (!messageRaw) {
    logInit(projectId, purpose, input.model, system, user, "FAILED", {
      responseText: res.text,
      errorMessage: "message 비어 있음",
      promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(res.text.length) },
    });
    return { ok: false, code: "SCHEMA", message: "AI 응답에 message가 없습니다." };
  }
  let chatBody = messageRaw;
  if (nextQuestion && !chatBody.includes(nextQuestion)) {
    chatBody = `${chatBody}\n\n${nextQuestion}`.trim();
  }

  const now = new Date().toISOString();
  const topic: FeaturePlanningTopicV1 = "FEATURES";
  const canReseedReuseSlots =
    input.mode === "chat_reseed" && Boolean(input.existingArtifact?.slots?.length);

  let slotsRaw = readSlotsFromInitResponse(o);
  if ((!slotsRaw || slotsRaw.length === 0) && canReseedReuseSlots) {
    slotsRaw = [...input.existingArtifact!.slots] as unknown[];
  }

  if (!Array.isArray(slotsRaw) || slotsRaw.length === 0) {
    logInit(projectId, purpose, input.model, system, user, "FAILED", {
      responseText: res.text,
      errorMessage: "slots 비어 있음",
      promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(res.text.length) },
    });
    return { ok: false, code: "SCHEMA", message: "AI 응답에 유효한 slots 배열이 없습니다." };
  }

  const priorFromCtx = input.ctx.confirmedActorRoleNames;
  const priorFromLlm = Array.isArray(o.priorStepActorRoles)
    ? o.priorStepActorRoles.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  const mergedPrior = [...new Set([...priorFromCtx, ...priorFromLlm])];

  const baseVersion = input.existingArtifact?.version ?? 1;
  const wrappedArtifact = {
    version: Math.max(1, baseVersion),
    slots: slotsRaw,
    recommendedOrder: Array.isArray(o.recommendedOrder) && o.recommendedOrder.length
      ? o.recommendedOrder
      : input.existingArtifact?.recommendedOrder,
    prototypeReadiness: o.prototypeReadiness ?? input.existingArtifact?.prototypeReadiness ?? {
      status: "NEEDS_REVIEW",
      missingItems: [],
      notes: "",
    },
    updatedAt: now,
    generatedAt: now,
    planningTopic: topic,
    ...(mergedPrior.length ? { priorStepActorRoles: mergedPrior } : {}),
  };

  let parsedArtifact = parseFeaturePlanningSlotsArtifactV1(wrappedArtifact);
  if (!parsedArtifact && canReseedReuseSlots && input.existingArtifact) {
    const memInit = mergeFeaturePlanningMemory(
      input.existingArtifact.planningMemoryV1 ?? defaultFeaturePlanningMemory(),
      parsePlanningMemoryPatch(o.planningMemory)
    );
    const artifactFromReuse: FeaturePlanningSlotsArtifactV1 = {
      ...input.existingArtifact,
      version: Math.max(1, input.existingArtifact.version + 1),
      updatedAt: now,
      planningTopic: topic,
      userEdited: false,
      planningMemoryV1: memInit,
    };
    const text = sanitizeFeaturePlanningUserVisibleKorean(chatBody).slice(0, 32_000);
    const aiMessage: FeaturePlanningWorkspaceChatMessageV1 = {
      id: `fp_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      role: "ai",
      text,
      at: now,
      plannerSurface: "initial_entry",
    };
    logInit(projectId, purpose, input.model, system, user, "SUCCESS", {
      responseText: res.text,
      parsedJson: JSON.stringify({
        message: messageRaw,
        nextQuestion,
        planningTopic: topic,
        slotCount: artifactFromReuse.slots.length,
        reseedSlotFallback: true,
      }).slice(0, 12_000),
      promptMetrics: {
        ...metricsBase,
        tokenEstimateOut: estimateTokensRough(res.text.length),
        memoryStateSnapshot: memorySnapshotForLog(artifactFromReuse.planningMemoryV1),
      },
    });
    return { ok: true, artifact: artifactFromReuse, aiMessage, model: input.model };
  }

  if (!parsedArtifact) {
    logInit(projectId, purpose, input.model, system, user, "FAILED", {
      responseText: res.text,
      errorMessage: "슬롯 스키마 파싱 실패",
      promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(res.text.length) },
    });
    return { ok: false, code: "SCHEMA", message: "기능 정리 슬롯 JSON 형식이 올바르지 않습니다." };
  }
  const stripped = stripLegacyRoleSlotsFromNewInitializeArtifact(parsedArtifact, input.ctx.confirmedActorRoleNames);
  const memBase =
    input.mode === "chat_reseed" && input.existingArtifact?.planningMemoryV1
      ? input.existingArtifact.planningMemoryV1
      : defaultFeaturePlanningMemory();
  const memInit = mergeFeaturePlanningMemory(memBase, parsePlanningMemoryPatch(o.planningMemory));
  const artifact: FeaturePlanningSlotsArtifactV1 = {
    ...stripped,
    planningTopic: topic,
    updatedAt: now,
    generatedAt: stripped.generatedAt ?? now,
    userEdited: false,
    planningMemoryV1: memInit,
  };

  const text = sanitizeFeaturePlanningUserVisibleKorean(chatBody).slice(0, 32_000);
  const aiMessage: FeaturePlanningWorkspaceChatMessageV1 = {
    id: `fp_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    role: "ai",
    text,
    at: now,
    plannerSurface: "initial_entry",
  };

  logInit(projectId, purpose, input.model, system, user, "SUCCESS", {
    responseText: res.text,
    parsedJson: JSON.stringify({ message: messageRaw, nextQuestion, planningTopic: topic, slotCount: artifact.slots.length }).slice(0, 12_000),
    promptMetrics: {
      ...metricsBase,
      tokenEstimateOut: estimateTokensRough(res.text.length),
      memoryStateSnapshot: memorySnapshotForLog(artifact.planningMemoryV1),
    },
  });

  return { ok: true, artifact, aiMessage, model: input.model };
}
