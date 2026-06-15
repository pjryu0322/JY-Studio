import { workingQueueStatusLabelKo } from "@/lib/prototype/implementationWorkingQueueClassifier";
import { workingQueueItemWorkflowLabel } from "@/lib/prototype/implementationWorkingQueueRoleLabels";
import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";
import { workingQueueItemRequestText } from "@/lib/prototype/implementationWorkingQueuePanelDisplay";

function buildSingleRegisteredMessageLines(input: Readonly<{
  readonly item: ImplementationWorkingQueueItem;
  readonly leadLine: string;
  readonly approveHint: string;
}>): string[] {
  return [
    input.leadLine,
    `요청: ${workingQueueItemRequestText(input.item)}`,
    `담당: ${workingQueueItemWorkflowLabel(input.item)}`,
    `상태: ${workingQueueStatusLabelKo(input.item.status)}`,
    input.approveHint,
  ];
}

export function buildWorkingQueuePreviewFeedbackRegisteredAiMessage(
  registered: readonly ImplementationWorkingQueueItem[],
): string {
  if (registered.length !== 1) {
    return buildWorkingQueueRegisteredAiMessage(registered);
  }
  const item = registered[0]!;
  return buildSingleRegisteredMessageLines({
    item,
    leadLine: "Preview 캡처 기준으로 작업대기에 등록했습니다.",
    approveHint: "실행하려면 작업대기에서 [승인] 버튼을 눌러 주세요.",
  }).join("\n");
}

export function buildWorkingQueueRegisteredAiMessage(
  registered: readonly ImplementationWorkingQueueItem[],
): string {
  if (registered.length === 1) {
    const item = registered[0]!;
    return buildSingleRegisteredMessageLines({
      item,
      leadLine: "보완요청을 작업대기에 등록했습니다.",
      approveHint: "실행하려면 작업대기에서 [승인] 버튼을 눌러 주세요.",
    }).join("\n");
  }
  const lines = registered.map(
    (item, i) =>
      `${i + 1}. ${workingQueueItemRequestText(item)} (담당: ${workingQueueItemWorkflowLabel(item)})`,
  );
  return [
    `보완요청 ${registered.length}건을 작업대기에 등록했습니다.`,
    ...lines,
    "실행할 항목은 작업대기에서 [승인] 버튼을 눌러 주세요.",
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
      "Fix CodeTask가 생성되었으며 Implementation 실행 파이프라인에 등록됩니다.",
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
