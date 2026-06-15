import { randomUUID } from "node:crypto";
import type { FeaturePlanningSlotsLlmContext } from "@/lib/featurePlanning/buildFeaturePlanningSlotsContext";
import {
  buildFeaturePlanningAnalyzeChecklistSystemPrompt,
  buildFeaturePlanningAnalyzeChecklistUserPrompt,
  estimateTokensRough,
} from "@/lib/featurePlanning/buildFeaturePlanningPrompt";
import type { FeaturePlanningPromptPurpose } from "@/lib/debug/featurePlanningPromptPurpose";
import { defaultFeaturePlanningMemory } from "@/lib/featurePlanning/featurePlanningMemory";
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
  buildFallbackPlanningChecklist,
  checklistToFeatureSlots,
  openingMessageFromChecklist,
} from "@/lib/featurePlanning/featurePlanningDynamicChecklist";
import {
  bundleFeaturePlanningSampleDataPersist,
  ensureSampleDataChecklistArea,
} from "@/lib/featurePlanning/featurePlanningSampleDataSync";
import type { SampleDataSpecV1 } from "@/lib/featurePlanning/sampleDataSpecV1";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  extractOpeningMessageFromAnalyzeRoot,
  parsePlanningChecklistAnalyzeResponse,
} from "@/lib/featurePlanning/featurePlanningPlanningChecklistParse";
import type { FeaturePlanningPlanningChecklistV1 } from "@/lib/featurePlanning/featurePlanningPlanningChecklistTypes";
import { memorySnapshotForLog } from "@/lib/featurePlanning/summarizeFeaturePlanningContext";
import { appendAiContextToSystemPrompt } from "@/lib/ai/knowledge/aiMemberContextInjection";

export type FeaturePlanningAnalyzeChecklistOk = {
  readonly ok: true;
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly aiMessage: FeaturePlanningWorkspaceChatMessageV1;
  readonly model: string;
  readonly usedFallbackChecklist: boolean;
  readonly sampleDataSpecV1: SampleDataSpecV1;
};

export type FeaturePlanningAnalyzeChecklistErr = { readonly ok: false; readonly code: string; readonly message: string };

function logAnalyze(
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

/** 기능정리 진입 — LLM으로 planningChecklistV1 + slots 생성. 실패 시 폴백 체크리스트. */
export async function runFeaturePlanningAnalyzeChecklistLlm(input: {
  readonly projectId: string;
  readonly ctx: FeaturePlanningSlotsLlmContext;
  readonly requirementsStateJson: unknown;
  readonly apiKey: string;
  readonly model: string;
  readonly firstStepTitle: string;
  readonly forceRegenerate?: boolean;
  readonly existingArtifact?: FeaturePlanningSlotsArtifactV1 | null;
  readonly promptPurpose?: FeaturePlanningPromptPurpose;
}): Promise<FeaturePlanningAnalyzeChecklistOk | FeaturePlanningAnalyzeChecklistErr> {
  const projectId = input.projectId.trim();
  const purpose = input.promptPurpose ?? "FEATURE_PLANNING_ANALYZE";
  const stepTitle = input.firstStepTitle.trim().slice(0, 120) || "서비스";
  const stateLine =
    input.forceRegenerate === true
      ? "기능 정리 초안 다시 만들기 — 체크리스트를 서비스 흐름에 맞게 새로 구성합니다."
      : "서비스 흐름 확정 후 첫 기능정리 분석";

  let system = buildFeaturePlanningAnalyzeChecklistSystemPrompt();
  system = await appendAiContextToSystemPrompt({
    aiMemberId: "feature_planning",
    baseSystem: system,
    projectId,
  });
  const user = buildFeaturePlanningAnalyzeChecklistUserPrompt({
    projectName: input.ctx.projectName,
    projectDescription: input.ctx.projectDescription,
    actorAndServiceFlowJson: input.ctx.actorServiceFlowText,
    ideationSnippet: input.ctx.ideationDeliverablesText,
    stateNote: stateLine,
  });

  const metricsBase: FeaturePlanningPromptMetricsV1 = {
    tokenEstimateIn: estimateTokensRough(system.length + user.length),
    compressedContextSize: user.length,
    topic: "FEATURES",
    memoryStateSnapshot: memorySnapshotForLog(input.existingArtifact?.planningMemoryV1),
  };

  const res = await openAiChatJsonText(input.apiKey, input.model, system, user, {
    label: "기능정리 체크리스트 분석",
    skipTimeline: true,
    temperature: 0.35,
  });

  let usedFallback = false;
  let checklist: FeaturePlanningPlanningChecklistV1 | null = null;
  let parsedRoot: Record<string, unknown> | null = null;

  if (res.ok) {
    const root = safeJsonParse(res.text);
    parsedRoot = root && typeof root === "object" ? (root as Record<string, unknown>) : null;
    checklist = parsedRoot ? parsePlanningChecklistAnalyzeResponse(parsedRoot) : null;
    if (!checklist) {
      usedFallback = true;
      checklist = buildFallbackPlanningChecklist({
        stepTitle,
        actorNames: input.ctx.confirmedActorRoleNames,
      });
      logAnalyze(projectId, purpose, input.model, system, user, "FAILED", {
        responseText: res.text,
        errorMessage: "체크리스트 JSON 검증 실패 → 폴백",
        promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(res.text.length) },
      });
    } else {
      logAnalyze(projectId, purpose, input.model, system, user, "SUCCESS", {
        responseText: res.text,
        parsedJson: JSON.stringify({ areaCount: checklist.areas.length }).slice(0, 8000),
        promptMetrics: { ...metricsBase, tokenEstimateOut: estimateTokensRough(res.text.length) },
      });
    }
  } else {
    usedFallback = true;
    checklist = buildFallbackPlanningChecklist({
      stepTitle,
      actorNames: input.ctx.confirmedActorRoleNames,
    });
    logAnalyze(projectId, purpose, input.model, system, user, "FAILED", {
      errorMessage: `${res.code}: ${res.message} → 폴백`,
      promptMetrics: metricsBase,
    });
  }

  checklist = ensureSampleDataChecklistArea(checklist);

  const now = new Date().toISOString();
  const topic: FeaturePlanningTopicV1 = "FEATURES";
  const slots = checklistToFeatureSlots(checklist);
  const mergedPrior = [...new Set([...input.ctx.confirmedActorRoleNames])];
  const baseVersion = input.existingArtifact?.version ?? 1;
  const memBase = input.existingArtifact?.planningMemoryV1 ?? defaultFeaturePlanningMemory();

  const wrappedArtifact = {
    version: Math.max(1, baseVersion),
    slots: slots as unknown[],
    recommendedOrder: slots.map((s) => s.slotId),
    prototypeReadiness: input.existingArtifact?.prototypeReadiness ?? {
      status: "NEEDS_REVIEW" as const,
      missingItems: [] as string[],
      notes: "",
    },
    updatedAt: now,
    generatedAt: now,
    planningTopic: topic,
    planningChecklistV1: checklist,
    ...(mergedPrior.length ? { priorStepActorRoles: mergedPrior } : {}),
    planningMemoryV1: memBase,
  };

  const parsedArtifact = parseFeaturePlanningSlotsArtifactV1(wrappedArtifact);
  if (!parsedArtifact) {
    return { ok: false, code: "SCHEMA", message: "슬롯 아티팩트 조립에 실패했습니다." };
  }
  const stripped = stripLegacyRoleSlotsFromNewInitializeArtifact(parsedArtifact, input.ctx.confirmedActorRoleNames);
  const artifactBase: FeaturePlanningSlotsArtifactV1 = {
    ...stripped,
    planningTopic: topic,
    planningChecklistV1: checklist,
    updatedAt: now,
    generatedAt: stripped.generatedAt ?? now,
    userEdited: false,
    planningMemoryV1: memBase,
  };

  const reqState = parseRequirementsStateJson(input.requirementsStateJson);
  const bundled = bundleFeaturePlanningSampleDataPersist({
    artifact: artifactBase,
    existingSpecRaw: reqState.sampleDataSpecV1,
    projectName: input.ctx.projectName,
    projectDescription: input.ctx.projectDescription,
  });
  const artifact: FeaturePlanningSlotsArtifactV1 = bundled.featurePlanningSlotsV1;

  const openingExtra = parsedRoot ? extractOpeningMessageFromAnalyzeRoot(parsedRoot) : null;
  const chatBody = openingExtra ?? openingMessageFromChecklist(checklist);
  const text = sanitizeFeaturePlanningUserVisibleKorean(chatBody).slice(0, 32_000);
  const aiMessage: FeaturePlanningWorkspaceChatMessageV1 = {
    id: `fp_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    role: "ai",
    text,
    at: now,
    plannerSurface: "initial_entry",
  };

  return {
    ok: true,
    artifact,
    aiMessage,
    model: input.model,
    usedFallbackChecklist: usedFallback,
    sampleDataSpecV1: bundled.sampleDataSpecV1,
  };
}
