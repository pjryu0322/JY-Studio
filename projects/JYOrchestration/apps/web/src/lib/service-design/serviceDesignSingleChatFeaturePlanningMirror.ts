import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";

export const FEATURE_PLANNING_MIRROR_INTERNAL_TYPE = "feature_planning_chat" as const;

export function shouldSkipFeaturePlanningMirror(params: {
  readonly messages: readonly RequirementsMessage[];
  readonly text: string;
  readonly mentionedAI: string | null;
  readonly nowIso: string;
  readonly windowMs?: number;
}): boolean {
  const text = String(params.text ?? "").trim();
  if (!text) return true;
  const now = Date.parse(params.nowIso);
  const windowMs = Math.max(1000, Math.floor(params.windowMs ?? 10_000));
  const tail = params.messages.slice(-6);
  for (let i = tail.length - 1; i >= 0; i--) {
    const m = tail[i]!;
    if (m.role !== "user") continue;
    if (String(m.content ?? "").trim() !== text) continue;
    const meta = (m.meta ?? {}) as { internalType?: string; serviceDesignStage?: string; mentionedAI?: string | null };
    if (String(meta.internalType ?? "") !== FEATURE_PLANNING_MIRROR_INTERNAL_TYPE) continue;
    if (String(meta.serviceDesignStage ?? "") !== "feature-planning") continue;
    if ((meta.mentionedAI ?? null) !== (params.mentionedAI ?? null)) continue;
    const created = Date.parse(String(m.createdAt ?? ""));
    if (!Number.isFinite(created) || !Number.isFinite(now)) continue;
    if (Math.abs(now - created) <= windowMs) return true;
  }
  return false;
}

export function buildFeaturePlanningMirroredUserTurn(params: {
  readonly text: string;
  readonly payload: ServiceDesignHarnessPayload;
  readonly speakerId: string;
  readonly speakerName: string;
  readonly createdAtIso?: string;
}): RequirementsMessage {
  const text = String(params.text ?? "").trim();
  return newRequirementsMessage({
    role: "user",
    speakerType: "USER",
    speakerId: params.speakerId || "me",
    speakerName: params.speakerName || "나",
    messageType: "STATEMENT",
    content: text,
    ...(params.createdAtIso ? { createdAt: params.createdAtIso } : {}),
    meta: {
      internalType: FEATURE_PLANNING_MIRROR_INTERNAL_TYPE,
      serviceDesignStage: "feature-planning",
      mentionedAI: params.payload.mentionedAI,
    },
  });
}

export function shouldSkipFeaturePlanningAiMirror(params: {
  readonly messages: readonly RequirementsMessage[];
  readonly text: string;
  readonly nowIso: string;
  readonly windowMs?: number;
}): boolean {
  const text = String(params.text ?? "").trim();
  if (!text) return true;
  const now = Date.parse(params.nowIso);
  const windowMs = Math.max(1000, Math.floor(params.windowMs ?? 10_000));
  const tail = params.messages.slice(-10);
  for (let i = tail.length - 1; i >= 0; i--) {
    const m = tail[i]!;
    if (m.role !== "ai") continue;
    if (String(m.content ?? "").trim() !== text) continue;
    const meta = (m.meta ?? {}) as { internalType?: string; serviceDesignStage?: string; mirroredRole?: string };
    if (String(meta.internalType ?? "") !== FEATURE_PLANNING_MIRROR_INTERNAL_TYPE) continue;
    if (String(meta.serviceDesignStage ?? "") !== "feature-planning") continue;
    if (String(meta.mirroredRole ?? "") !== "ai") continue;
    const created = Date.parse(String(m.createdAt ?? ""));
    if (!Number.isFinite(created) || !Number.isFinite(now)) continue;
    if (Math.abs(now - created) <= windowMs) return true;
  }
  return false;
}

export function buildFeaturePlanningMirroredAiTurn(params: {
  readonly text: string;
  readonly speakerId?: string;
  readonly speakerName?: string;
  readonly createdAtIso?: string;
}): RequirementsMessage {
  const text = String(params.text ?? "").trim();
  return newRequirementsMessage({
    role: "ai",
    speakerType: "AI",
    speakerId: (params.speakerId ?? "feature_planning").trim() || "feature_planning",
    speakerName: (params.speakerName ?? "AI 설계자").trim() || "AI 설계자",
    messageType: "ANSWER",
    content: text,
    ...(params.createdAtIso ? { createdAt: params.createdAtIso } : {}),
    meta: {
      internalType: FEATURE_PLANNING_MIRROR_INTERNAL_TYPE,
      serviceDesignStage: "feature-planning",
      mirroredRole: "ai",
    },
  });
}

