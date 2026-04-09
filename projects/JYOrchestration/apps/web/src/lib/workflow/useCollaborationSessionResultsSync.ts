"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getCollaborationSessionResultsVersion,
  subscribeCollaborationSessionResults,
} from "@/lib/workflow/collaborationSessionResultStore";
import { hydrateBusinessExecutionCoreFromPersistence } from "@/lib/workflow/businessExecutionPersistence";

/** Subscribe to in-memory collaboration result changes (cross-page). Returns a version counter for useMemo deps. */
export function useCollaborationSessionResultsVersion(): number {
  useEffect(() => {
    hydrateBusinessExecutionCoreFromPersistence();
  }, []);
  return useSyncExternalStore(
    subscribeCollaborationSessionResults,
    getCollaborationSessionResultsVersion,
    getCollaborationSessionResultsVersion
  );
}
