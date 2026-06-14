import {
  affectedAreaLabelKo,
  riskLevelLabelKo,
  workingQueueStatusLabelKo,
} from "@/lib/prototype/implementationWorkingQueueClassifier";
import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";

function formatItemBlock(item: ImplementationWorkingQueueItem, index: number): string {
  return [
    `${index + 1}. ${item.title}`,
    `- 영향 영역: ${affectedAreaLabelKo(item.affectedArea)}`,
    `- 위험도: ${riskLevelLabelKo(item.riskLevel)}`,
    `- 상태: ${workingQueueStatusLabelKo(item.status)}`,
  ].join("\n");
}

export function buildWorkingQueueRegisteredAiMessage(
  registered: readonly ImplementationWorkingQueueItem[],
): string {
  if (registered.length === 1) {
    const item = registered[0]!;
    return [
      "보완요청을 작업대기에 등록했습니다.",
      "",
      formatItemBlock(item, 0),
      "",
      '이 작업을 진행하려면 "진행해"라고 말씀해 주세요.',
    ].join("\n");
  }
  const lines = registered.map((item, i) => `${i + 1}. ${item.title}`);
  return [
    `보완요청 ${registered.length}건을 작업대기에 등록했습니다.`,
    "",
    ...lines,
    "",
    "진행할 항목을 승인해 주세요. (예: 「진행해」, 「1번만 진행해」)",
  ].join("\n");
}

export function buildWorkingQueueControlAiMessage(input: {
  readonly approved: readonly ImplementationWorkingQueueItem[];
  readonly deferred: readonly ImplementationWorkingQueueItem[];
  readonly rejected: readonly ImplementationWorkingQueueItem[];
}): string {
  const parts: string[] = [];
  if (input.approved.length) {
    parts.push(
      `${input.approved.length}건을 승인했습니다.`,
      ...input.approved.map((i, idx) => `${idx + 1}. ${i.title} — ${workingQueueStatusLabelKo("approved")}`),
      "",
      "실행 준비가 완료되었습니다. 후속 CodeTask 생성은 다음 단계에서 연결됩니다.",
    );
  }
  if (input.deferred.length) {
    parts.push(
      `${input.deferred.length}건을 보류했습니다.`,
      ...input.deferred.map((i) => `- ${i.title}`),
    );
  }
  if (input.rejected.length) {
    parts.push(
      `${input.rejected.length}건을 거절했습니다.`,
      ...input.rejected.map((i) => `- ${i.title}`),
    );
  }
  if (!parts.length) {
    return "변경할 작업대기 항목을 찾지 못했습니다. 툴바의 「작업대기」에서 목록을 확인해 주세요.";
  }
  return parts.join("\n");
}
