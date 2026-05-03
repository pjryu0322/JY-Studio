import type { FeaturePlanningSlotsLlmContext } from "@/lib/featurePlanning/buildFeaturePlanningSlotsContext";
import {
  buildFeaturePlanningInitializeSystemPrompt,
  buildFeaturePlanningInitializeUserPrompt,
} from "@/lib/featurePlanning/buildFeaturePlanningInitializePrompt";
import { openAiChatJsonText, safeJsonParse } from "@/lib/featurePlanning/featurePlanningOpenAi";
import { stripLegacyRoleSlotsFromNewInitializeArtifact } from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import type { FeaturePlanningTopicV1 } from "@/lib/featurePlanning/featurePlanningTopic";
import {
  normalizeFeaturePlanningSlotType,
  parseFeaturePlanningSlotsArtifactV1,
  type FeaturePlanningSlotsArtifactV1,
} from "@/lib/featurePlanning/featurePlanningSlotsArtifact";

export type FeaturePlanningInitializeLlmOk = {
  ok: true;
  artifact: FeaturePlanningSlotsArtifactV1;
  model: string;
};

export type FeaturePlanningInitializeLlmErr = { ok: false; code: string; message: string };

export async function runFeaturePlanningInitializeLlm(
  ctx: FeaturePlanningSlotsLlmContext,
  apiKey: string,
  model: string
): Promise<FeaturePlanningInitializeLlmOk | FeaturePlanningInitializeLlmErr> {
  const system = buildFeaturePlanningInitializeSystemPrompt();
  const user = buildFeaturePlanningInitializeUserPrompt(ctx);
  const res = await openAiChatJsonText(apiKey, model, system, user, { label: "기능 정리 슬롯 초기화", skipTimeline: true });
  if (!res.ok) return res;

  const root = safeJsonParse(res.text);
  if (!root || typeof root !== "object") {
    return { ok: false, code: "PARSE", message: "AI JSON 파싱에 실패했습니다." };
  }
  const o = root as Record<string, unknown>;
  const now = new Date().toISOString();
  const rawPrior = o.priorStepActorRoles;
  const priorFromLlm = Array.isArray(rawPrior) ? rawPrior.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
  const artifact = parseFeaturePlanningSlotsArtifactV1({
    version: 1,
    slots: o.slots,
    recommendedOrder: o.recommendedOrder,
    prototypeReadiness: o.prototypeReadiness,
    updatedAt: now,
    ...(priorFromLlm.length ? { priorStepActorRoles: priorFromLlm } : {}),
  });
  if (!artifact) {
    return { ok: false, code: "SCHEMA", message: "기능 정리 AI 응답 형식이 올바르지 않습니다." };
  }
  const normalizedSlots = artifact.slots.map((s) => ({
    ...s,
    slotType: normalizeFeaturePlanningSlotType(s.slotType),
  }));
  const stripped = stripLegacyRoleSlotsFromNewInitializeArtifact(
    {
      ...artifact,
      slots: normalizedSlots,
      version: 1,
      updatedAt: now,
      generatedAt: now,
    },
    ctx.confirmedActorRoleNames
  );
  return {
    ok: true,
    artifact: { ...stripped, planningTopic: (stripped.planningTopic ?? "FEATURES") as FeaturePlanningTopicV1 },
    model,
  };
}
