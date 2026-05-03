import {
  buildFeaturePlanningChatSystemPrompt,
  buildFeaturePlanningChatUserPrompt,
  type FeaturePlanningChatPlanningContextV1,
} from "@/lib/featurePlanning/buildFeaturePlanningChatPrompt";
import { ensureFeaturePlanningQuestionSuffix } from "@/lib/featurePlanning/featurePlanningInteractiveBubble";
import { openAiChatJsonText, safeJsonParse } from "@/lib/featurePlanning/featurePlanningOpenAi";
import type { FeaturePlanningTopicV1 } from "@/lib/featurePlanning/featurePlanningTopic";
import { parsePlanningTopic } from "@/lib/featurePlanning/featurePlanningTopic";
import {
  mergePlannerArtifactPreservingLegacySlots,
  stripLegacyRoleSlotsFromNewInitializeArtifact,
} from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import {
  normalizeFeaturePlanningSlotType,
  parseFeaturePlanningSlotsArtifactV1,
  type FeaturePlanningSlotsArtifactV1,
} from "@/lib/featurePlanning/featurePlanningSlotsArtifact";

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

export async function runFeaturePlanningChatLlm(input: {
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly chatTranscript: string;
  readonly userMessage: string;
  readonly planningContext: FeaturePlanningChatPlanningContextV1;
  readonly apiKey: string;
  readonly model: string;
}): Promise<FeaturePlanningChatLlmOk | FeaturePlanningChatLlmErr> {
  const currentTopic: FeaturePlanningTopicV1 = input.artifact.planningTopic ?? "FEATURES";
  const system = buildFeaturePlanningChatSystemPrompt();
  const user = buildFeaturePlanningChatUserPrompt({
    artifact: input.artifact,
    chatTranscript: input.chatTranscript,
    userMessage: input.userMessage,
    currentTopic,
    planningContext: input.planningContext,
  });
  const res = await openAiChatJsonText(input.apiKey, input.model, system, user, { label: "기능 정리 플래너" });
  if (!res.ok) return res;

  const root = safeJsonParse(res.text);
  if (!root || typeof root !== "object") {
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
    return { ok: false, code: "SCHEMA", message: "기능 정리 AI 응답 형식이 올바르지 않습니다." };
  }

  let artifact: FeaturePlanningSlotsArtifactV1 = {
    ...artifactBase,
    planningTopic: parsePlanningTopic(o.planningTopic) ?? input.artifact.planningTopic ?? "FEATURES",
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

  artifact = {
    ...artifact,
    planningTopic: parsePlanningTopic(o.planningTopic) ?? artifact.planningTopic ?? "FEATURES",
  };

  const resultSummary = buildResultSummary(changeSummary);
  const composed = ensureFeaturePlanningQuestionSuffix(composeTurnText(aiMessage, nextQuestions));

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
