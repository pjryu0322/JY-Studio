import { randomUUID } from "node:crypto";
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
import { FEATURE_PLANNING_TOPICS, type FeaturePlanningTopicV1 } from "@/lib/featurePlanning/featurePlanningTopic";
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
import { buildPlannerStepFocus } from "@/lib/featurePlanning/featurePlanningPlannerPromptContext";

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

/** 채팅 턴 — 모델이 init 경로와 혼동해 `slots`만 줄 때가 많아 둘 다 허용 */
function readChatTurnSlotsFromResponse(o: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(o.updatedSlots) && o.updatedSlots.length) return o.updatedSlots;
  if (Array.isArray(o.slots) && o.slots.length) return o.slots;
  return null;
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

function itemNameKey(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

function newPlannerItemId(): string {
  return `fpi_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

type ParsedPlannerFeatureV2 = { title: string; detail: string; priority?: string };

function parsePlannerV2Features(raw: unknown): ParsedPlannerFeatureV2[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedPlannerFeatureV2[] = [];
  for (const x of raw.slice(0, 12)) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    const detail =
      typeof r.detail === "string"
        ? r.detail.trim()
        : typeof r.description === "string"
          ? r.description.trim()
          : "";
    if (!title) continue;
    const priority = typeof r.priority === "string" ? r.priority.trim() : "";
    out.push({ title, detail, priority: priority || undefined });
  }
  return out.slice(0, 8);
}

function parseRecommendedStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 12);
}

function isPlannerV2Shape(o: Record<string, unknown>): boolean {
  return typeof o.question === "string" && o.question.trim().length > 0 && Array.isArray(o.features);
}

function mergePlannerV2FeaturesIntoArtifact(
  base: FeaturePlanningSlotsArtifactV1,
  focusSlotId: string,
  features: ParsedPlannerFeatureV2[],
  recommended: string[]
): FeaturePlanningSlotsArtifactV1 {
  const now = new Date().toISOString();
  const nextVersion = Math.max(1, (base.version ?? 1) + 1);
  const slots = base.slots.map((slot) => {
    if (slot.slotId !== focusSlotId) return slot;
    const seen = new Set(slot.items.map((it) => itemNameKey(it.name)));
    const items = [...slot.items];
    for (const f of features) {
      const k = itemNameKey(f.title);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const pri = f.priority ? ` 우선순위: ${f.priority}.` : "";
      items.push({
        id: newPlannerItemId(),
        name: f.title.slice(0, 200),
        description: `${f.detail.slice(0, 3800)}${pri}`.trim(),
        metadata: { plannerSource: "PLANNER_V2" },
      });
    }
    const featTitles = new Set(features.map((f) => itemNameKey(f.title)));
    for (const rec of recommended) {
      const k = itemNameKey(rec);
      if (!k || seen.has(k) || featTitles.has(k)) continue;
      seen.add(k);
      items.push({
        id: newPlannerItemId(),
        name: rec.slice(0, 200),
        description: "추천 기능(한 줄 제안)",
        metadata: { plannerSource: "PLANNER_REC" },
      });
    }
    return { ...slot, items: items.slice(0, 200) };
  });
  return { ...base, slots, updatedAt: now, version: nextVersion, userEdited: false };
}

function buildPlannerV2DisplayMessage(input: {
  readonly message: string;
  readonly features: ParsedPlannerFeatureV2[];
  readonly recommended: string[];
  readonly question: string;
  readonly currentStepTitle: string;
}): string {
  let m = input.message.trim();
  if (!m) {
    m = `먼저 [${input.currentStepTitle}] 단계의 기능을 정리하겠습니다.`;
  }
  if (input.features.length && !/후보 기능|현재 후보/i.test(m)) {
    const bullets = input.features.map((f) => `- ${f.title.trim()}`).join("\n");
    m += `\n\n현재 후보 기능:\n${bullets}`;
  }
  if (input.recommended.length && !/추천 기능/i.test(m)) {
    m += `\n\n추천 기능:\n${input.recommended.map((r) => `- ${r}`).join("\n")}`;
  }
  const q = input.question.trim();
  if (q && !m.includes(q)) {
    m += `\n\n질문:\n${q}`;
  }
  return ensureFeaturePlanningQuestionSuffix(m);
}

function parseProgress(o: Record<string, unknown>): { done: number; total: number } | null {
  const p = o.progress;
  if (!p || typeof p !== "object") return null;
  const r = p as Record<string, unknown>;
  const done = typeof r.done === "number" && Number.isFinite(r.done) ? Math.max(0, Math.floor(r.done)) : NaN;
  const total = typeof r.total === "number" && Number.isFinite(r.total) ? Math.max(0, Math.floor(r.total)) : NaN;
  if (!Number.isFinite(done) || !Number.isFinite(total)) return null;
  return { done, total: Math.max(1, total) };
}

function handlePlannerV2Response(input: {
  readonly pid: string;
  readonly o: Record<string, unknown>;
  readonly resText: string;
  readonly inputCtx: {
    readonly artifact: FeaturePlanningSlotsArtifactV1;
    readonly requirementsStateJson: unknown;
    readonly workspaceMessages: readonly FeaturePlanningWorkspaceChatMessageV1[];
    readonly projectName: string;
    readonly projectDescription: string;
  };
  readonly metricsBase: FeaturePlanningPromptMetricsV1;
  readonly system: string;
  readonly user: string;
  readonly model: string;
  readonly currentTopic: FeaturePlanningTopicV1;
}): FeaturePlanningChatLlmOk | FeaturePlanningChatLlmErr {
  const { pid, o, resText, inputCtx, metricsBase, system, user, model, currentTopic } = input;
  const question = String(o.question ?? "").trim();
  const features = parsePlannerV2Features(o.features);
  const recommended = parseRecommendedStrings(o.recommended);
  const messageRaw = typeof o.message === "string" ? o.message.trim() : "";

  if (features.length < 1) {
    logChatTurn(pid, {
      model,
      system,
      user,
      status: "FAILED",
      responseText: resText,
      errorMessage: "features 배열 비어 있음(3~6개 권장)",
      promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(resText.length) },
    });
    return { ok: false, code: "SCHEMA", message: "AI 응답에 현재 단계 기능 후보(features)가 없습니다. 다시 시도해 주세요." };
  }
  if (features.length > 8) {
    logChatTurn(pid, {
      model,
      system,
      user,
      status: "FAILED",
      responseText: resText,
      errorMessage: "features 개수 초과",
      promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(resText.length) },
    });
    return { ok: false, code: "SCHEMA", message: "기능 후보는 8개 이하로 정리해 주세요." };
  }

  const focus = buildPlannerStepFocus({
    requirementsStateJson: inputCtx.requirementsStateJson,
    artifact: inputCtx.artifact,
    workspaceMessages: inputCtx.workspaceMessages,
  });
  const focusSlotId = focus.focusSlotId || inputCtx.artifact.slots[0]?.slotId;
  if (!focusSlotId) {
    logChatTurn(pid, {
      model,
      system,
      user,
      status: "FAILED",
      responseText: resText,
      errorMessage: "focus 슬롯 없음",
      promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(resText.length) },
    });
    return { ok: false, code: "SCHEMA", message: "정리 영역(슬롯)이 없어 응답을 반영할 수 없습니다." };
  }

  let artifact = mergePlannerV2FeaturesIntoArtifact(inputCtx.artifact, focusSlotId, features, recommended);
  artifact = stripLegacyRoleSlotsFromNewInitializeArtifact(artifact, [
    ...(inputCtx.artifact.priorStepActorRoles ?? []),
    ...(artifact.priorStepActorRoles ?? []),
  ]);
  artifact = mergePlannerArtifactPreservingLegacySlots(inputCtx.artifact, artifact);

  const nextStepSuggested = o.nextStepSuggested === true;
  const idx = FEATURE_PLANNING_TOPICS.indexOf(currentTopic);
  const proposedNext =
    nextStepSuggested && idx >= 0 && idx < FEATURE_PLANNING_TOPICS.length - 1 ? FEATURE_PLANNING_TOPICS[idx + 1] : undefined;
  let nextTopic = normalizePlanningTopicTransition(currentTopic, proposedNext);

  const memPatch = parsePlanningMemoryPatch(o.planningMemory);
  let mem = mergeFeaturePlanningMemory(inputCtx.artifact.planningMemoryV1, memPatch);
  const prog = parseProgress(o);
  if (prog) {
    mem = mergeFeaturePlanningMemory(mem, {
      notes: [`flowProgress:${prog.done}/${prog.total}`],
    });
  }

  artifact = {
    ...artifact,
    planningTopic: nextTopic,
    planningMemoryV1: mem,
    generatedAt: inputCtx.artifact.generatedAt ?? inputCtx.artifact.updatedAt,
  };

  const normalizedSlots = artifact.slots.map((s) => ({
    ...s,
    slotType: normalizeFeaturePlanningSlotType(s.slotType),
  }));
  artifact = { ...artifact, slots: normalizedSlots };

  const composed = buildPlannerV2DisplayMessage({
    message: messageRaw,
    features,
    recommended,
    question,
    currentStepTitle: focus.currentStepTitle,
  });

  const changeSummary = [
    ...features.map((f) => `${f.title}${f.detail ? ` — ${f.detail.slice(0, 120)}` : ""}`),
    ...recommended.map((r) => `추천: ${r}`),
  ];
  const resultSummary = buildResultSummary(changeSummary);

  const plannerMeta: FeaturePlanningPlannerTurnMetaV1 = {
    newFeatureCandidates: recommended.length ? recommended : features.map((f) => f.title),
    filledSlotsSummary: features.map((f) => f.title),
    nextQuestions: [question],
  };

  let parsedForLog: string;
  try {
    parsedForLog = JSON.stringify(o).slice(0, 12_000);
  } catch {
    parsedForLog = "";
  }
  logChatTurn(pid, {
    model,
    system,
    user,
    status: "SUCCESS",
    responseText: resText,
    parsedJson: parsedForLog || undefined,
    promptMetrics: {
      ...metricsBase,
      tokenEstimateOut: estimateTokensRough(resText.length),
      topic: nextTopic,
      memoryStateSnapshot: memorySnapshotForLog(artifact.planningMemoryV1),
    },
  });

  return {
    ok: true,
    artifact,
    aiMessage: composed,
    resultSummary,
    plannerMeta,
    model,
  };
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

  const res = await openAiChatJsonText(input.apiKey, input.model, system, user, {
    label: "기능 정리 플래너",
    skipTimeline: true,
    temperature: 0.35,
  });
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

  if (isPlannerV2Shape(o)) {
    return handlePlannerV2Response({
      pid,
      o,
      resText: res.text,
      inputCtx: {
        artifact: input.artifact,
        requirementsStateJson: input.requirementsStateJson,
        workspaceMessages: input.workspaceMessages,
        projectName: input.projectName,
        projectDescription: input.projectDescription,
      },
      metricsBase,
      system,
      user,
      model: input.model,
      currentTopic,
    });
  }

  const slotsRaw = readChatTurnSlotsFromResponse(o);
  const recommendedOrder = Array.isArray(o.recommendedOrder)
    ? o.recommendedOrder.map((x) => String(x ?? "").trim()).filter(Boolean)
    : input.artifact.recommendedOrder;
  const nextVersion = Math.max(1, (input.artifact.version ?? 1) + 1);
  const now = new Date().toISOString();

  if (!slotsRaw) {
    logChatTurn(pid, {
      model: input.model,
      system,
      user,
      status: "FAILED",
      responseText: res.text,
      errorMessage: "레거시: updatedSlots/slots 없음 · v2 키(message/features/question)도 없음",
      promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(res.text.length) },
    });
    return {
      ok: false,
      code: "SCHEMA",
      message: "기능 정리 AI 응답 형식이 올바르지 않습니다. (슬롯 배열 또는 신규 JSON 스키마 필요)",
    };
  }

  const artifactBase = parseFeaturePlanningSlotsArtifactV1({
    version: nextVersion,
    slots: slotsRaw,
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
      errorMessage: "슬롯 항목 파싱 실패(updatedSlots/slots 내용)",
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
