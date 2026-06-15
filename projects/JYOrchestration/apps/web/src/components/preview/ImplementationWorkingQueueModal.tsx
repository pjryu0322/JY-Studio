"use client";

import { ImplementationExecutionBoardModal } from "@/components/preview/ImplementationExecutionBoardModal";
import { ImplementationWorkingQueuePanel } from "@/components/preview/ImplementationWorkingQueuePanel";
import type {
  ImplementationWorkingQueueItem,
  ImplementationWorkingQueueV1,
} from "@/lib/prototype/implementationWorkingQueueTypes";
import type { ReactNode } from "react";

export function ImplementationWorkingQueueModal(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly queue: ImplementationWorkingQueueV1;
  readonly onApproveItem: (itemId: string) => void;
  readonly onDeferItem: (itemId: string) => void;
  readonly onRejectItem: (itemId: string) => void;
  readonly resolvePreviewImageUrl?: (item: ImplementationWorkingQueueItem) => string | null;
}): ReactNode {
  return (
    <ImplementationExecutionBoardModal open={props.open} onClose={props.onClose} ariaLabel="작업대기">
      <div
        data-testid="implementation-working-queue-modal"
        style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
      >
        <ImplementationWorkingQueuePanel
          queue={props.queue}
          onClose={props.onClose}
          onApproveItem={props.onApproveItem}
          onDeferItem={props.onDeferItem}
          onRejectItem={props.onRejectItem}
          resolvePreviewImageUrl={props.resolvePreviewImageUrl}
        />
      </div>
    </ImplementationExecutionBoardModal>
  );
}
