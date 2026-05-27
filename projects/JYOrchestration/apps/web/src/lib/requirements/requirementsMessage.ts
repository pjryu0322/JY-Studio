export type RequirementsMessageRole = "user" | "ai" | "human" | "system";

/** 사용자 질문의 복수 대상(단일 targetId/targetName과 병행 저장 가능) */
export type RequirementsMessageTarget = { id: string; name: string };

export type RequirementsSpeakerType = "USER" | "AI" | "HUMAN" | "SYSTEM";
export type RequirementsVisibility = "PUBLIC";
export type RequirementsMessageType = "QUESTION" | "STATEMENT" | "ANSWER" | "NOTICE" | "FRIENDLY_ERROR";

import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";

export type RequirementsMessageMeta = {
  stage: "REQUIREMENTS";
  promptVersion?: string;
  /** 내부 처리용(사용자 노출 금지) */
  internalType?: string;
  /** AI bootstrap/응답 출처(디버그/감사용) */
  source?: "llm" | "fallback";
  /** bootstrap이 fallback인 경우 이유(디버그/감사용) */
  fallbackReason?: string;
  /** 문제정의 인터뷰에서 직전에 물은 슬롯(반복 질문 방지·복원용) */
  problemInterviewLastSlot?: string;
  /** 인터뷰 유도형 선택지(참고용, 강제 아님) */
  interviewSuggestions?: readonly string[];
  /** 기본 true — 항상 자유 입력 가능 */
  interviewAllowCustomInput?: boolean;
  /** Quick Design / 기획안 생성 산출물 ID(기획안 보기 칩 연동) */
  fastPlanArtifactId?: string;
  /** Quick Design 확정 후 4영역 산출물 ID 목록 */
  quickDesignArtifactIds?: readonly string[];
  /** Quick Design 확정 후 구현 준비 후보 gap key(기획정보 보완 패널·메시지 요약) */
  implementationCandidateGapKeys?: readonly string[];
  /** Service Design SingleChat: stage tag (no DB schema change; JSON payload field) */
  serviceDesignStage?: RequirementsWorkspaceStage;
  /** Service Design SingleChat: mention routing hint */
  mentionedAI?: string | null;
  /** Service Design SingleChat: mirrored role hint (for adapters/debug) */
  mirroredRole?: "user" | "ai";
  /** 사용자 답글: 대상 메시지가 인터뷰 질문이었을 때 슬롯 키(오케스트레이션 맥락) */
  replyToSlotKey?: string;
  /** 사용자 답글: 대상 메시지 발화자(speakerId) */
  replyTargetSpeakerId?: string;
  /**
   * H7: 해당 AI 응답과 함께 생성된 overlay+harness extract 스냅샷(read-only explainability).
   * 사용자 메시지에는 저장하지 않는 것이 일반적이다.
   */
  messageOverlayExplainability?: ExtractedOverlayPromptTraceMetadata | null;
  /** 구현 단계: 파생(상태) 메시지 정렬 키 — 영구 저장하지 않음 */
  prototypeOrderKey?: number;
  /** 구현 진입 bootstrap: lead_developer_summary 등 */
  implementationBootstrapKind?: string;
};

/** 요구사항 협의실 메시지(JSON 저장용). */
export type RequirementsMessage = {
  id: string;
  role: RequirementsMessageRole;
  speakerType: RequirementsSpeakerType;
  speakerId: string;
  speakerName: string;
  /** 답글(스레드)용: 어떤 메시지에 대한 reply인지 */
  replyTo?: string | null;
  targetId?: string | null;
  targetName?: string | null;
  /** 복수 질문 대상(없으면 targetId/targetName만 사용) */
  targets?: readonly RequirementsMessageTarget[] | null;
  visibility: RequirementsVisibility;
  messageType: RequirementsMessageType;
  content: string;
  createdAt: string;
  meta: RequirementsMessageMeta;
};

export const REQUIREMENTS_PROMPT_VERSION = "v1" as const;

let requirementsMessageFallbackIdCounter = 0;

function createRequirementsMessageId(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  requirementsMessageFallbackIdCounter += 1;
  return `m-${Date.now()}-${requirementsMessageFallbackIdCounter}-${Math.random().toString(36).slice(2, 11)}`;
}

/** React key 충돌·이중 append 방지: 동일 id는 선행 메시지를 유지합니다. */
export function dedupeRequirementsMessagesById(
  messages: readonly RequirementsMessage[],
): RequirementsMessage[] {
  const seen = new Set<string>();
  const out: RequirementsMessage[] = [];
  for (const m of messages) {
    const id = String(m.id ?? "").trim();
    if (!id) {
      out.push(m);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(m);
  }
  return out;
}

export function newRequirementsMessage(input: Omit<RequirementsMessage, "id" | "createdAt" | "visibility" | "meta"> & {
  id?: string;
  createdAt?: string;
  visibility?: RequirementsVisibility;
  meta?: Partial<RequirementsMessageMeta>;
}): RequirementsMessage {
  const id = input.id ?? createRequirementsMessageId();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const targets =
    Array.isArray(input.targets) && input.targets.length > 0 ? (input.targets.map((t) => ({ id: String(t.id), name: String(t.name) })) as RequirementsMessageTarget[]) : undefined;
  return {
    id,
    role: input.role,
    speakerType: input.speakerType,
    speakerId: String(input.speakerId ?? ""),
    speakerName: String(input.speakerName ?? ""),
    replyTo: typeof input.replyTo === "string" ? input.replyTo : input.replyTo === null ? null : undefined,
    targetId: input.targetId ?? null,
    targetName: input.targetName ?? null,
    ...(targets && targets.length ? { targets } : {}),
    visibility: input.visibility ?? "PUBLIC",
    messageType: input.messageType,
    content: input.content,
    createdAt,
    meta: {
      stage: "REQUIREMENTS",
      promptVersion: REQUIREMENTS_PROMPT_VERSION,
      ...(input.meta ?? {}),
    },
  };
}

export function isRequirementsMessage(v: unknown): v is RequirementsMessage {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.role === "string" &&
    typeof o.speakerType === "string" &&
    typeof o.speakerId === "string" &&
    typeof o.speakerName === "string" &&
    typeof o.visibility === "string" &&
    typeof o.messageType === "string" &&
    typeof o.content === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.meta === "object" &&
    o.meta !== null
  );
}

/**
 * DB/API에서 내려온 메시지가 스키마와 약간 달라도(예: meta 누락, body/at 키, assistant 역할)
 * UI에서 복원 가능한 형태로 보정합니다.
 */
export function coerceRequirementsMessage(v: unknown): RequirementsMessage | null {
  if (isRequirementsMessage(v)) return v;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;

  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : null;
  const roleRaw = typeof o.role === "string" ? o.role.trim() : "";
  const role: RequirementsMessageRole | null =
    roleRaw === "user" || roleRaw === "ai" || roleRaw === "human" || roleRaw === "system"
      ? roleRaw
      : roleRaw === "assistant"
        ? "ai"
        : null;
  if (!id || !role) return null;

  const content =
    typeof o.content === "string"
      ? o.content
      : typeof o.body === "string"
        ? o.body
        : "";
  if (!String(content).trim()) return null;

  const createdAt =
    typeof o.createdAt === "string"
      ? o.createdAt
      : typeof o.at === "string"
        ? o.at
        : new Date().toISOString();

  const speakerTypeRaw = typeof o.speakerType === "string" ? o.speakerType : "";
  const speakerType: RequirementsSpeakerType =
    speakerTypeRaw === "USER" || speakerTypeRaw === "AI" || speakerTypeRaw === "HUMAN" || speakerTypeRaw === "SYSTEM"
      ? speakerTypeRaw
      : role === "user"
        ? "USER"
        : role === "ai"
          ? "AI"
          : role === "human"
            ? "HUMAN"
            : "SYSTEM";

  const speakerId =
    typeof o.speakerId === "string" && o.speakerId.trim()
      ? o.speakerId.trim()
      : role === "user"
        ? "me"
        : role === "ai"
          ? "ai"
          : role === "human"
            ? "member"
            : "system";

  const speakerName =
    typeof o.speakerName === "string" && o.speakerName.trim()
      ? o.speakerName.trim()
      : typeof o.authorName === "string" && o.authorName.trim()
        ? o.authorName.trim()
        : role === "user"
          ? "나"
          : role === "ai"
            ? "AI"
            : role === "human"
              ? "멤버"
              : "시스템";

  const messageTypeRaw = typeof o.messageType === "string" ? o.messageType : "";
  const messageType: RequirementsMessageType =
    messageTypeRaw === "QUESTION" ||
    messageTypeRaw === "STATEMENT" ||
    messageTypeRaw === "ANSWER" ||
    messageTypeRaw === "NOTICE" ||
    messageTypeRaw === "FRIENDLY_ERROR"
      ? messageTypeRaw
      : role === "system"
        ? "NOTICE"
        : role === "ai"
          ? "ANSWER"
          : "STATEMENT";

  const targetId =
    o.targetId === null
      ? null
      : typeof o.targetId === "string"
        ? o.targetId
        : typeof o.directedToId === "string"
          ? o.directedToId
          : undefined;

  const targetName =
    o.targetName === null
      ? null
      : typeof o.targetName === "string"
        ? o.targetName
        : typeof o.directedToName === "string"
          ? o.directedToName
          : undefined;

  const replyTo =
    o.replyTo === null ? null : typeof o.replyTo === "string" && o.replyTo.trim() ? o.replyTo.trim() : undefined;

  const visibility: RequirementsVisibility = o.visibility === "PUBLIC" ? "PUBLIC" : "PUBLIC";

  const metaIn = o.meta;
  const metaPartial =
    metaIn && typeof metaIn === "object" && metaIn !== null ? (metaIn as Partial<RequirementsMessageMeta>) : undefined;

  let targets: RequirementsMessageTarget[] | undefined;
  if (Array.isArray(o.targets)) {
    const parsed: RequirementsMessageTarget[] = [];
    for (const row of o.targets) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const tid = typeof r.id === "string" ? r.id.trim() : "";
      const tnm = typeof r.name === "string" ? r.name.trim() : "";
      if (tid) parsed.push({ id: tid, name: tnm || tid });
    }
    if (parsed.length) targets = parsed;
  }

  return newRequirementsMessage({
    id,
    role,
    speakerType,
    speakerId,
    speakerName,
    ...(replyTo !== undefined ? { replyTo } : {}),
    targetId: targetId ?? null,
    targetName: targetName ?? null,
    ...(targets && targets.length ? { targets } : {}),
    visibility,
    messageType,
    content,
    createdAt,
    meta: metaPartial,
  });
}

