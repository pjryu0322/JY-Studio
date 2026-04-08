"use client";

import { useSyncExternalStore } from "react";
import {
  getCollaborationSessionResultsVersion,
  subscribeCollaborationSessionResults,
} from "@/lib/workflow/collaborationSessionResultStore";

/** Subscribe to in-memory collaboration result changes (cross-page). Returns a version counter for useMemo deps. */
export function useCollaborationSessionResultsVersion(): number {
  return useSyncExternalStore(
    subscribeCollaborationSessionResults,
    getCollaborationSessionResultsVersion,
    getCollaborationSessionResultsVersion
  );
}
