import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import {
  extractOverlayPromptTraceMetadata,
  type ExtractedOverlayPromptTraceMetadata,
} from "@/lib/overlay/overlayPromptTraceExtract";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";

/** SingleChat explainability 매핑에 쓰는 최소 메시지 shape. */
export type SingleChatMessageLike = Readonly<
  Pick<RequirementsMessage, "id" | "role" | "createdAt" | "content" | "speakerId"> & {
    readonly meta?: RequirementsMessage["meta"];
  }
>;

function overlayExtractHasRenderableFields(ex: ExtractedOverlayPromptTraceMetadata | null | undefined): boolean {
  if (!ex || typeof ex !== "object") return false;
  for (const v of Object.values(ex)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length > 0) return true;
    if (typeof v === "object" && Object.keys(v as object).length > 0) return true;
  }
  return false;
}

function orchestratorAgentsForSpeakerId(speakerId: string | undefined): readonly string[] | null {
  const s = String(speakerId ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "virtual:ai-analyst" || s.includes("ai-analyst")) return ["analyst"];
  if (s === "virtual:ai-architect" || s.includes("ai-architect")) return ["architect"];
  if (s === "virtual:ai-designer" || s.includes("ai-designer")) return ["designer"];
  if (s === "virtual:ai-security" || s.includes("ai-security")) return ["security"];
  if (s === VIRTUAL_AI_PLANNER_ID.toLowerCase() || s.includes("ai-planner")) return ["planner", "reviewer"];
  return null;
}

function parseTimeMs(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * AI 응답 메시지에 붙일 overlay+harness extract를 **안전하게** 결정한다.
 *
 * 우선순위: (1) 메시지 meta 직접 보유 → (2) 타임라인 `responseText`가 본문과 일치하는 단일 후보 →
 * (3) 화자(virtual id)와 `orchestratorAgent`가 일치하고 시간창 내 단일 후보.
 * 불명확하면 `null`(억지 연결 금지).
 */
export function resolveMessageExplainabilityTrace(input: {
  readonly message: SingleChatMessageLike;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
}): ExtractedOverlayPromptTraceMetadata | null {
  const { message, promptTimeline } = input;
  if (message.role !== "ai") return null;

  const direct = message.meta?.messageOverlayExplainability ?? null;
  if (overlayExtractHasRenderableFields(direct)) {
    return direct;
  }

  const timeline = Array.isArray(promptTimeline) ? promptTimeline : [];
  if (!timeline.length) return null;

  const body = String(message.content ?? "").trim();
  if (body.length >= 8) {
    const byResponse = timeline.filter((e) => {
      const rt = String(e.responseText ?? "").trim();
      if (rt !== body) return false;
      const msgT = parseTimeMs(message.createdAt);
      const entT = parseTimeMs(e.createdAt);
      if (msgT === null || entT === null) return false;
      return Math.abs(entT - msgT) <= 120_000;
    });
    if (byResponse.length === 1) {
      const ex = extractOverlayPromptTraceMetadata(byResponse[0]);
      return overlayExtractHasRenderableFields(ex) ? ex : null;
    }
  }

  const agents = orchestratorAgentsForSpeakerId(message.speakerId);
  if (agents?.length) {
    const msgT = parseTimeMs(message.createdAt);
    if (msgT !== null) {
      const windowMs = 90_000;
      const near = timeline.filter((e) => {
        const entT = parseTimeMs(e.createdAt);
        if (entT === null) return false;
        if (Math.abs(entT - msgT) > windowMs) return false;
        const oa = String(e.orchestratorAgent ?? "").trim().toLowerCase();
        return agents.some((a) => a === oa);
      });
      if (near.length === 1) {
        const ex = extractOverlayPromptTraceMetadata(near[0]);
        return overlayExtractHasRenderableFields(ex) ? ex : null;
      }
    }
  }

  return null;
}
