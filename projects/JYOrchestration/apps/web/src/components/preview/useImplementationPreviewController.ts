"use client";

import { useCallback, useState, type MutableRefObject } from "react";
import { ensureCompletedCodeTaskPreviewForFallback } from "@/lib/prototype/completedCodeTaskPreviewBuildService";
import { shouldRunCompletedCodeTaskPreviewFallbackOnOpen } from "@/lib/prototype/completedCodeTaskPreviewFallback";
import { parseCodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { mergeIntegrationPullRequestClient } from "@/lib/prototype/implementationIntegrationClient";
import {
  buildCodeTaskPreviewFallbackUrl,
  sanitizeIntegratedAppPreviewUrl,
  type ImplementationPreviewEntryModeV1,
} from "@/lib/prototype/implementationPreviewEntryPolicy";
import { resolveIntegratedAppPreviewReadyFromOrchestration } from "@/lib/prototype/implementationPreviewReadiness";
import { isLikelyPreviewUrl } from "@/lib/prototype/previewUrlClassification";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * Controls implementation-stage Preview entry actions.
 *
 * Scope:
 * - open integrated app Preview
 * - open CodeTask result Preview
 * - run completed CodeTask preview fallback when needed
 * - persist Preview fallback orchestration patch
 * - merge integration pull request from the Preview action area
 *
 * Not scope:
 * - Integration pipeline execution
 * - Quick Run internals
 * - GitHub verification internals
 * - board rendering
 * - generated project source patching
 */
export type ImplementationPreviewControllerInput = Readonly<{
  readonly projectId: string;
  readonly previewUrl: string | null | undefined;
  readonly latestRunPreviewUrl?: string | null;
  readonly latestRunSuggestedPreviewUrl?: string | null;
  readonly orchestrationAwareRequirementsStateRef: MutableRefObject<RequirementsStateJson>;
  readonly applyPendingFromOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput | undefined,
  ) => void;
  readonly persistChatToDb: (
    chat?: unknown,
    orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput,
    message?: unknown,
    options?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<unknown> | void;
}>;

export type ImplementationPreviewControllerValue = Readonly<{
  readonly integrationMergeBusy: boolean;
  readonly mergeIntegrationPullRequest: () => void;
  readonly openImplementationPreview: (input: {
    readonly mode: ImplementationPreviewEntryModeV1;
    readonly url: string;
  }) => void;
}>;

export function useImplementationPreviewController(
  input: ImplementationPreviewControllerInput,
): ImplementationPreviewControllerValue {
  const [integrationMergeBusy, setIntegrationMergeBusy] = useState(false);

  const mergeIntegrationPullRequest = useCallback(() => {
    const pid = input.projectId.trim();
    if (!pid) {
      return;
    }
    void (async () => {
      setIntegrationMergeBusy(true);
      try {
        const result = await mergeIntegrationPullRequestClient({ projectId: pid });
        if (result.ok) {
        } else {
        }
      } catch (error) {
      } finally {
        setIntegrationMergeBusy(false);
      }
    })();
  }, [input.projectId]);

  const openImplementationPreview = useCallback(
    (previewInput: { readonly mode: ImplementationPreviewEntryModeV1; readonly url: string }) => {
      void (async () => {
        const pid = input.projectId.trim();
        if (!pid || !previewInput.url.trim()) return;

        if (previewInput.mode === "integrated_app_preview") {
          const url = sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: previewInput.url });
          if (!url) return;
          window.open(url, "_blank", "noopener,noreferrer");
          return;
        }

        if (previewInput.mode !== "codetask_result_preview") return;

        const orchestration = input.orchestrationAwareRequirementsStateRef.current;
        const integratedReady = resolveIntegratedAppPreviewReadyFromOrchestration({
          projectId: pid,
          orchestration,
        });
        if (integratedReady) return;

        let openUrl = previewInput.url.trim();
        if (
          shouldRunCompletedCodeTaskPreviewFallbackOnOpen({
            mode: previewInput.mode,
            integratedAppPreviewReady: integratedReady,
            previewScopeV1: orchestration.implementationPreviewScopeV1,
            previewRuntimeV1: orchestration.implementationPreviewRuntimeV1,
          })
        ) {
          const integrationPlan = parseCodeTaskIntegrationPlanV1(
            orchestration.codeTaskIntegrationPlanV1,
          );
          const externalPreviewUrl =
            input.previewUrl ??
            (input.latestRunPreviewUrl && isLikelyPreviewUrl(input.latestRunPreviewUrl)
              ? input.latestRunPreviewUrl.trim()
              : null) ??
            (input.latestRunSuggestedPreviewUrl &&
            isLikelyPreviewUrl(input.latestRunSuggestedPreviewUrl)
              ? input.latestRunSuggestedPreviewUrl.trim()
              : null);

          const fallback = await ensureCompletedCodeTaskPreviewForFallback({
            projectId: pid,
            actionSource: "preview_button",
            orchestration,
            externalPreviewUrl,
            sourceIntegrationBranch: integrationPlan?.integrationBranch ?? null,
          });
          if (!fallback.ok) {
            return;
          }
          if (fallback.orchestrationPatch) {
            input.applyPendingFromOrchestrationPatch(fallback.orchestrationPatch);
            await input.persistChatToDb(undefined, fallback.orchestrationPatch, undefined, {
              awaitServer: false,
              force: true,
            });
          }
          openUrl = fallback.previewUrl?.trim() || buildCodeTaskPreviewFallbackUrl(pid);
        }

        window.open(openUrl, "_blank", "noopener,noreferrer");
      })();
    },
    [
      input.projectId,
      input.persistChatToDb,
      input.applyPendingFromOrchestrationPatch,
      input.previewUrl,
      input.latestRunPreviewUrl,
      input.latestRunSuggestedPreviewUrl,
      input.orchestrationAwareRequirementsStateRef,
    ],
  );

  return {
    integrationMergeBusy,
    mergeIntegrationPullRequest,
    openImplementationPreview,
  };
}
