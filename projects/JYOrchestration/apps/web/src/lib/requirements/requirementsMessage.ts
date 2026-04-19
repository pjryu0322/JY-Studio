export type RequirementsMessageRole = "user" | "ai" | "human" | "system";

export type RequirementsSpeakerType = "USER" | "AI" | "HUMAN" | "SYSTEM";
export type RequirementsVisibility = "PUBLIC";
export type RequirementsMessageType = "QUESTION" | "STATEMENT" | "ANSWER" | "NOTICE" | "FRIENDLY_ERROR";

export type RequirementsMessageMeta = {
  stage: "REQUIREMENTS";
  promptVersion?: string;
  /** 내부 처리용(사용자 노출 금지) */
  internalType?: string;
};

/** 요구사항 협의실 메시지(JSON 저장용). */
export type RequirementsMessage = {
  id: string;
  role: RequirementsMessageRole;
  speakerType: RequirementsSpeakerType;
  speakerId: string;
  speakerName: string;
  targetId?: string | null;
  targetName?: string | null;
  visibility: RequirementsVisibility;
  messageType: RequirementsMessageType;
  content: string;
  createdAt: string;
  meta: RequirementsMessageMeta;
};

export const REQUIREMENTS_PROMPT_VERSION = "v1" as const;

export function newRequirementsMessage(input: Omit<RequirementsMessage, "id" | "createdAt" | "visibility" | "meta"> & {
  id?: string;
  createdAt?: string;
  visibility?: RequirementsVisibility;
  meta?: Partial<RequirementsMessageMeta>;
}): RequirementsMessage {
  const id =
    input.id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `m-${Date.now()}-${Math.random()}`);
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    id,
    role: input.role,
    speakerType: input.speakerType,
    speakerId: String(input.speakerId ?? ""),
    speakerName: String(input.speakerName ?? ""),
    targetId: input.targetId ?? null,
    targetName: input.targetName ?? null,
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

  const visibility: RequirementsVisibility = o.visibility === "PUBLIC" ? "PUBLIC" : "PUBLIC";

  const metaIn = o.meta;
  const metaPartial =
    metaIn && typeof metaIn === "object" && metaIn !== null ? (metaIn as Partial<RequirementsMessageMeta>) : undefined;

  return newRequirementsMessage({
    id,
    role,
    speakerType,
    speakerId,
    speakerName,
    targetId: targetId ?? null,
    targetName: targetName ?? null,
    visibility,
    messageType,
    content,
    createdAt,
    meta: metaPartial,
  });
}

