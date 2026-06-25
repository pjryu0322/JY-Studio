import type { KnowledgeNodeSensitivity } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";

const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /credential/i,
  /bearer\s+/i,
  /sk-[a-z0-9]/i,
];

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const INTERNAL_ID_HINT_PATTERN =
  /\b(eventId|revisionId|nodeId|candidateId|pipelineRunId)\b/i;

export type ReferenceSafetyAssessment = KnowledgeNodeSensitivity &
  Readonly<{
    readonly reasons: readonly string[];
  }>;

export function assessReferenceSafety(input: Readonly<{
  readonly title?: string | null;
  readonly summary?: string | null;
  readonly text?: string | null;
  readonly containsConversationExcerpt?: boolean;
  readonly containsPersonalMemo?: boolean;
}>): ReferenceSafetyAssessment {
  const blob = `${input.title ?? ""}\n${input.summary ?? ""}\n${input.text ?? ""}`;
  const reasons: string[] = [];

  const containsConfidentialData = SENSITIVE_PATTERNS.some((re) => re.test(blob));
  if (containsConfidentialData) reasons.push("민감한 자격 증명 패턴");

  const containsRawConversation = Boolean(input.containsConversationExcerpt);
  if (containsRawConversation) reasons.push("대화 원문 포함");

  const containsPersonalData = Boolean(input.containsPersonalMemo);
  if (containsPersonalData) reasons.push("개인 메모 가능성");

  const containsInternalIds =
    UUID_PATTERN.test(blob) || INTERNAL_ID_HINT_PATTERN.test(blob);
  if (containsInternalIds) reasons.push("내부 식별자 포함");

  const safeForReference =
    !containsConfidentialData &&
    !containsRawConversation &&
    !containsPersonalData &&
    !containsInternalIds;

  return {
    containsPersonalData,
    containsConfidentialData,
    containsRawConversation,
    containsInternalIds,
    safeForReference,
    reasons,
  };
}

/** @deprecated Use assessReferenceSafety */
export function assessKnowledgeNodeSensitivity(input: Readonly<{
  readonly title: string;
  readonly summary?: string | null;
  readonly containsConversationExcerpt?: boolean;
  readonly containsPersonalMemo?: boolean;
}>): KnowledgeNodeSensitivity {
  const result = assessReferenceSafety(input);
  return {
    containsPersonalData: result.containsPersonalData,
    containsConfidentialData: result.containsConfidentialData,
    containsRawConversation: result.containsRawConversation,
    containsInternalIds: result.containsInternalIds,
    safeForReference: result.safeForReference,
  };
}

export function isTextSafeForReferencePackage(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  return assessReferenceSafety({ text: trimmed }).safeForReference && trimmed.length <= 2000;
}
