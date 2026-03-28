/** Execution setup 정책: 민감 영역 Task는 사람 승인 게이트 */

export function taskLooksSensitive(task: {
  name: string;
  description: string | null;
  acceptanceCriteria: string[];
}): boolean {
  const blob = `${task.name}\n${task.description ?? ""}\n${task.acceptanceCriteria.join("\n")}`.toLowerCase();
  return /\b(secret|secrets|password|passwd|credential|credentials|oauth|api[_-]?key|auth|jwt|session|token|encrypt|encryption|payment|pci|pii|2fa|mfa|sso)\b/.test(
    blob
  );
}
