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

