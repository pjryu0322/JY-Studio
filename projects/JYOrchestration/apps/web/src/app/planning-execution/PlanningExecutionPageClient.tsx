"use client";

/**
 * Entry client for `/planning-execution`.
 *
 * UI → route → facade → normalized response → view-model → screen.
 *
 * UI calls the **route only**. The route calls the **application facade only**.
 * Raw internal bundles (handoff/prep/bridge/seed payloads) never reach this component.
 */

import { useEffect, useMemo, useState } from "react";
import type {
  PlanningExecutionStructuralAction,
  PlanningOriginatedExecutionStatus,
} from "@jy-orch/application/public";
import { demoPlanningExecutionScreenViewModel } from "@/components/planningExecution/planningExecutionDemoSamples";
import { PlanningExecutionWorkspace } from "@/components/planningExecution/PlanningExecutionWorkspace";
import { runPlanningOriginatedExecution } from "@/lib/jy-orchestration/planning-execution";

const STATUSES: readonly PlanningOriginatedExecutionStatus[] = [
  "BLOCKED",
  "NEEDS_CONFIRMATION",
  "READY_FOR_EXECUTION",
  "EXECUTION_STARTED",
  "EXECUTION_START_FAILED",
] as const;

type UiRequestState =
  | { readonly kind: "idle" }
  | { readonly kind: "submitting"; readonly mode: "PREPARE_ONLY" | "PREPARE_AND_START" }
  | { readonly kind: "validation_error"; readonly issues: readonly string[] }
  | { readonly kind: "transport_error"; readonly message: string }
  | { readonly kind: "auth_error"; readonly message: string }
  | { readonly kind: "forbidden"; readonly message: string }
  | { readonly kind: "parse_error"; readonly message: string };

export function PlanningExecutionPageClient() {
  const [useDemo, setUseDemo] = useState(false);
  const [demoStatus, setDemoStatus] = useState<PlanningOriginatedExecutionStatus>("READY_FOR_EXECUTION");
  const [projectId, setProjectId] = useState("");
  const [inputText, setInputText] = useState("");
  const [lastAction, setLastAction] = useState<PlanningExecutionStructuralAction | null>(null);
  const [reqState, setReqState] = useState<UiRequestState>({ kind: "idle" });

  const screen = useMemo(() => {
    if (useDemo) return demoPlanningExecutionScreenViewModel(demoStatus);
    // Until the first live response arrives, keep a deterministic skeleton screen (still view-model based).
    return demoPlanningExecutionScreenViewModel("READY_FOR_EXECUTION");
  }, [demoStatus, useDemo]);

  const inFlight = reqState.kind === "submitting";

  async function submit(mode: "PREPARE_ONLY" | "PREPARE_AND_START") {
    setReqState({ kind: "submitting", mode });
    const r = await runPlanningOriginatedExecution({ projectId, inputText, mode });
    switch (r.status) {
      case "success":
        setReqState({ kind: "idle" });
        return r.screen;
      case "validation_error":
        setReqState({ kind: "validation_error", issues: r.issues });
        return null;
      case "auth_error":
        setReqState({ kind: "auth_error", message: r.message });
        return null;
      case "forbidden":
        setReqState({ kind: "forbidden", message: r.message });
        return null;
      case "parse_error":
        setReqState({ kind: "parse_error", message: r.message });
        return null;
      case "transport_error":
        setReqState({ kind: "transport_error", message: r.message });
        return null;
      default: {
        const _exhaustive: never = r;
        return _exhaustive;
      }
    }
  }

  const [liveScreen, setLiveScreen] = useState(() => demoPlanningExecutionScreenViewModel("READY_FOR_EXECUTION"));

  useEffect(() => {
    if (useDemo) {
      setLiveScreen(demoPlanningExecutionScreenViewModel(demoStatus));
    }
  }, [useDemo, demoStatus]);

  return (
    <div className="min-h-screen bg-neutral-100/80">
      <div className="border-b border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-neutral-700">
            <input
              type="checkbox"
              checked={useDemo}
              onChange={(e) => setUseDemo(e.target.checked)}
            />
            Use demo fixtures
          </label>

          {useDemo ? (
            <>
              <label className="font-medium text-neutral-800" htmlFor="demo-status-select">
                Demo status
              </label>
              <select
                id="demo-status-select"
                className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 font-mono text-xs"
                value={demoStatus}
                onChange={(e) => setDemoStatus(e.target.value as PlanningOriginatedExecutionStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <input
                className="w-44 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                placeholder="projectId"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={inFlight}
              />
              <button
                type="button"
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-50"
                disabled={inFlight}
                onClick={async () => {
                  const next = await submit("PREPARE_ONLY");
                  if (next) setLiveScreen(next);
                }}
              >
                Prepare only
              </button>
              <button
                type="button"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                disabled={inFlight}
                onClick={async () => {
                  const next = await submit("PREPARE_AND_START");
                  if (next) setLiveScreen(next);
                }}
              >
                Prepare & start
              </button>
            </>
          )}

          {lastAction ? (
            <span className="font-mono text-xs text-neutral-600">
              Last structural action: <strong>{lastAction}</strong> (placeholder)
            </span>
          ) : (
            <span className="text-xs text-neutral-500">Use action bar — handlers are placeholders.</span>
          )}
        </div>
        {!useDemo && reqState.kind !== "idle" ? (
          <div className="mx-auto mt-2 max-w-3xl">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
              {reqState.kind === "submitting" ? (
                <span className="font-mono">Submitting ({reqState.mode})…</span>
              ) : reqState.kind === "validation_error" ? (
                <span>
                  <strong>Validation:</strong> {reqState.issues.join(" · ")}
                </span>
              ) : reqState.kind === "auth_error" ? (
                <span>
                  <strong>Auth:</strong> {reqState.message}
                </span>
              ) : reqState.kind === "forbidden" ? (
                <span>
                  <strong>Forbidden:</strong> {reqState.message}
                </span>
              ) : reqState.kind === "parse_error" ? (
                <span>
                  <strong>Parse:</strong> {reqState.message}
                </span>
              ) : (
                <span>
                  <strong>Network:</strong> {reqState.message}
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>
      <PlanningExecutionWorkspace
        screen={useDemo ? screen : liveScreen}
        inputText={inputText}
        onInputTextChange={setInputText}
        inputDisabled={inFlight}
        onStructuralAction={async (a) => {
          setLastAction(a);

          if (useDemo) return;
          if (inFlight) return;

          // Minimal wiring:
          // - actions that imply a (re)start will call the route
          // - others stay as deterministic placeholders / local UX intent
          if (a === "START_EXECUTION" || a === "RETRY_EXECUTION") {
            const next = await submit("PREPARE_AND_START");
            if (next) setLiveScreen(next);
            return;
          }
          if (a === "REVIEW_CONFIRMATION") {
            // "Proceed" attempt still goes through the route+facade; if confirmation is still required,
            // backend will keep returning NEEDS_CONFIRMATION (no auto-skip).
            const next = await submit("PREPARE_AND_START");
            if (next) setLiveScreen(next);
            return;
          }
          if (a === "REFRESH_STATUS") {
            const next = await submit("PREPARE_ONLY");
            if (next) setLiveScreen(next);
            return;
          }
          if (a === "EDIT_INPUT") {
            const el = document.getElementById("planning-input-text");
            if (el && "focus" in el) (el as HTMLTextAreaElement).focus();
            return;
          }
          if (a === "INSPECT_FAILURE") {
            // Placeholder: for now, the actionable details are already in the message panel.
            return;
          }
          if (a === "VIEW_RUN_STATUS") {
            // Placeholder: no monitoring surface wired yet (keep simple as requested).
            // We still provide REFRESH_STATUS to re-query via the same route.
            return;
          }
        }}
      />
    </div>
  );
}
