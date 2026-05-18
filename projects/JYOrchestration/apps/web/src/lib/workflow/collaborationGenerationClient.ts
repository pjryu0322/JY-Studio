"use client";

import type { CollaborationActionResult, CollaborationActionType } from "@/lib/workflow/collaborationActionContract";
import {
  isCollaborationGenerationApiErr,
  isCollaborationGenerationApiOk,
  parseCollaborationActionResultFromApi,
} from "@/lib/workflow/collaborationActionContract";

const ROUTES: Record<CollaborationActionType, string> = {
  GENERATE_MINUTES: "/api/workflow/collaboration/generate-minutes",
  GENERATE_FEATURES: "/api/workflow/collaboration/generate-features",
  GENERATE_TASKS: "/api/workflow/collaboration/generate-tasks",
  REQUEST_ANALYSIS: "/api/workflow/collaboration/request-analysis",
  REQUEST_IDEAS: "/api/workflow/collaboration/request-ideas",
};

/**
 * Calls the workflow API route for the given action. Parses the JSON envelope into a typed result.
 * Keeps the collaboration page free of fetch/parse details.
 */
export async function requestCollaborationGeneration(
  actionType: CollaborationActionType,
  sessionId: string
): Promise<CollaborationActionResult> {
  const atIso = () => new Date().toISOString();

  try {
    const res = await fetch(ROUTES[actionType], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = isCollaborationGenerationApiErr(json)
        ? json.error
        : `Request failed (${res.status})`;
      return {
        actionType,
        status: "error",
        message: msg,
        atIso: atIso(),
        payload: null,
      };
    }

    if (!isCollaborationGenerationApiOk(json) || json.result == null) {
      return {
        actionType,
        status: "error",
        message: "Invalid response from collaboration generation API.",
        atIso: atIso(),
        payload: null,
      };
    }

    const parsed = parseCollaborationActionResultFromApi(actionType, json.result);
    if (!parsed) {
      return {
        actionType,
        status: "error",
        message: "Could not parse collaboration generation result.",
        atIso: atIso(),
        payload: null,
      };
    }

    return parsed;
  } catch (e) {
    const message = e instanceof Error ? e.message : "네트워크 오류";
    return {
      actionType,
      status: "error",
      message,
      atIso: atIso(),
      payload: null,
    };
  }
}
