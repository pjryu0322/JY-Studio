"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Controls implementation-stage deliverable viewer state.
 *
 * Scope:
 * - open deliverable viewer with selected asset ids
 * - track focused deliverable asset id
 * - close deliverable viewer
 * - expose deliverable viewer view model
 *
 * Not scope:
 * - deliverable rendering
 * - recommendation evidence calculation
 * - project artifact generation
 * - board rendering
 */
export type ImplementationDeliverableViewerControllerValue = Readonly<{
  readonly deliverableViewer: {
    readonly open: boolean;
    readonly focusAssetId: string | null;
    readonly openDeliverables: (ids: readonly string[], focusId?: string | null) => void;
    readonly close: () => void;
  };
}>;

export function useImplementationDeliverableViewerController(): ImplementationDeliverableViewerControllerValue {
  const [deliverableViewerOpen, setDeliverableViewerOpen] = useState(false);
  const [deliverableViewerFocusId, setDeliverableViewerFocusId] = useState<string | null>(null);

  const openDeliverableViewer = useCallback((ids: readonly string[], focusId?: string | null) => {
    setDeliverableViewerFocusId(focusId ?? ids[0] ?? null);
    setDeliverableViewerOpen(true);
  }, []);

  const closeDeliverableViewer = useCallback(() => {
    setDeliverableViewerOpen(false);
  }, []);

  const deliverableViewer = useMemo(
    () => ({
      open: deliverableViewerOpen,
      focusAssetId: deliverableViewerFocusId,
      openDeliverables: openDeliverableViewer,
      close: closeDeliverableViewer,
    }),
    [deliverableViewerOpen, deliverableViewerFocusId, openDeliverableViewer, closeDeliverableViewer],
  );

  return {
    deliverableViewer,
  };
}
