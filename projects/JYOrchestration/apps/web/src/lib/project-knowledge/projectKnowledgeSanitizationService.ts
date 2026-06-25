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

export function assessKnowledgeNodeSensitivity(input: Readonly<{
  readonly title: string;
  readonly summary?: string | null;
  readonly containsConversationExcerpt?: boolean;
  readonly containsPersonalMemo?: boolean;
}>): KnowledgeNodeSensitivity {
  const blob = `${input.title}\n${input.summary ?? ""}`;
  const containsConfidentialData = SENSITIVE_PATTERNS.some((re) => re.test(blob));
  const containsRawConversation = Boolean(input.containsConversationExcerpt);
  const containsPersonalData = Boolean(input.containsPersonalMemo);
  const containsInternalIds = false;

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
  };
}

export function isTextSafeForReferencePackage(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  if (SENSITIVE_PATTERNS.some((re) => re.test(trimmed))) return false;
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(trimmed)) {
    return false;
  }
  return trimmed.length <= 2000;
}
