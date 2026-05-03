import type { FeaturePlanningSlotsLlmContext } from "@/lib/featurePlanning/buildFeaturePlanningSlotsContext";
import {
  buildFeaturePlanningFirstMessageSystemPrompt,
  buildFeaturePlanningFirstMessageUserPrompt,
  type FeaturePlanningFirstMessageLlmOutputV1,
  type FeaturePlanningRecommendedCategoryV1,
} from "@/lib/featurePlanning/buildFeaturePlanningFirstMessagePrompt";
import { openAiChatJsonText, safeJsonParse } from "@/lib/featurePlanning/featurePlanningOpenAi";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";

export type FeaturePlanningFirstMessageLlmOk = { ok: true; data: FeaturePlanningFirstMessageLlmOutputV1; model: string };
export type FeaturePlanningFirstMessageLlmErr = { ok: false; code: string; message: string };

function parseCategories(raw: unknown): FeaturePlanningRecommendedCategoryV1[] {
  if (!Array.isArray(raw)) return [];
  const out: FeaturePlanningRecommendedCategoryV1[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const reason = typeof o.reason === "string" ? o.reason.trim() : "";
    if (!name) continue;
    out.push({ name: name.slice(0, 120), reason: reason.slice(0, 400) });
    if (out.length >= 12) break;
  }
  return out;
}

export async function runFeaturePlanningFirstMessageLlm(input: {
  readonly ctx: FeaturePlanningSlotsLlmContext;
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly apiKey: string;
  readonly model: string;
}): Promise<FeaturePlanningFirstMessageLlmOk | FeaturePlanningFirstMessageLlmErr> {
  const system = buildFeaturePlanningFirstMessageSystemPrompt();
  const user = buildFeaturePlanningFirstMessageUserPrompt(input.ctx, input.artifact);
  const res = await openAiChatJsonText(input.apiKey, input.model, system, user, { label: "기능 정리 첫 메시지", skipTimeline: true });
  if (!res.ok) return res;

  const root = safeJsonParse(res.text);
  if (!root || typeof root !== "object") {
    return { ok: false, code: "PARSE", message: "첫 메시지 JSON 파싱에 실패했습니다." };
  }
  const o = root as Record<string, unknown>;
  const firstMessage = typeof o.firstMessage === "string" ? o.firstMessage.trim() : "";
  const recommendedCategories = parseCategories(o.recommendedCategories);
  const nextFocus = String(o.nextFocus ?? "").trim().toUpperCase() === "CATEGORY_SELECTION" ? "CATEGORY_SELECTION" : "CATEGORY_SELECTION";

  const hasQuestion = /\[질문\]/i.test(firstMessage) || /\?|？/.test(firstMessage);
  if (!firstMessage || recommendedCategories.length < 3 || !/\[초안\]/i.test(firstMessage) || !hasQuestion) {
    return { ok: false, code: "SCHEMA", message: "첫 메시지 또는 카테고리 목록이 부족합니다." };
  }

  return {
    ok: true,
    data: { firstMessage, recommendedCategories, nextFocus },
    model: input.model,
  };
}
