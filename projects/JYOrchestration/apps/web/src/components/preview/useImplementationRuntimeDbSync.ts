import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { fetchImplementationRuntime } from "@/lib/runtime/implementationRuntime/implementationRuntimeClient";
import type {
  ImplementationRuntimeBundleView,
  ImplementationRuntimeDiagnosticsRow,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import { shouldPollImplementationRuntime } from "@/lib/runtime/implementationRuntime/implementationRuntimeUiFlow";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { isInFlightTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";

export function useImplementationRuntimeDbSync(input: {
  readonly projectId: string;
  readonly taskCursorExecutionV1: unknown;
}): Readonly<{
  readonly implementationRuntimeDbBundle: ImplementationRuntimeBundleView | null;
  readonly setImplementationRuntimeDbBundle: Dispatch<SetStateAction<ImplementationRuntimeBundleView | null>>;
  readonly implementationRuntimeDbDiagnostics: readonly ImplementationRuntimeDiagnosticsRow[];
  readonly loadImplementationRuntimeDb: (options?: { readonly recover?: boolean }) => Promise<void>;
  readonly applyImplementationRuntimeFetch: (
    fetched: Awaited<ReturnType<typeof fetchImplementationRuntime>>,
  ) => void;
  readonly implementationRuntimePollSuspendedRef: Readonly<{ readonly current: boolean }>;
}> {
  const pollSuspendedRef = useRef(false);
  const [implementationRuntimeDbBundle, setImplementationRuntimeDbBundle] =
    useState<ImplementationRuntimeBundleView | null>(null);
  const [implementationRuntimeDbDiagnostics, setImplementationRuntimeDbDiagnostics] = useState<
    readonly ImplementationRuntimeDiagnosticsRow[]
  >([]);

  const applyImplementationRuntimeFetch = useCallback(
    (fetched: Awaited<ReturnType<typeof fetchImplementationRuntime>>) => {
      if (fetched.bundle) setImplementationRuntimeDbBundle(fetched.bundle);
      if (fetched.diagnostics?.length) {
        setImplementationRuntimeDbDiagnostics(fetched.diagnostics);
      }
    },
    [],
  );

  const loadImplementationRuntimeDb = useCallback(
    async (options?: { readonly recover?: boolean }) => {
      const pid = input.projectId.trim();
      if (!pid) return;
      if (pollSuspendedRef.current && options?.recover !== true) {
        return;
      }
      try {
        const fetched = await fetchImplementationRuntime(pid, options);
        if (!fetched.success) {
          const message = fetched.message ?? "";
          if (message.includes("DB 스키마가 최신") || message.includes("pnpm db:migrate")) {
            pollSuspendedRef.current = true;
            console.warn("[implementation-runtime]", message.split(". ")[0] ?? message);
          }
          return;
        }
        pollSuspendedRef.current = false;
        applyImplementationRuntimeFetch(fetched);
      } catch {
        // ignore transient poll errors (dev recompile / network)
      }
    },
    [applyImplementationRuntimeFetch, input.projectId],
  );

  useEffect(() => {
    void loadImplementationRuntimeDb({ recover: false });
  }, [loadImplementationRuntimeDb]);

  useEffect(() => {
    const pid = input.projectId.trim();
    if (!pid) return;
    const legacyCursor = parseTaskCursorExecutionV1(input.taskCursorExecutionV1);
    if (pollSuspendedRef.current) {
      return;
    }
    if (
      !shouldPollImplementationRuntime({
        bundle: implementationRuntimeDbBundle,
        legacyCursorInFlight: Boolean(
          legacyCursor && isInFlightTaskCursorExecution(legacyCursor),
        ),
      })
    ) {
      return;
    }
    const timer = setInterval(() => {
      void loadImplementationRuntimeDb({ recover: true });
    }, 10_000);
    return () => clearInterval(timer);
  }, [
    implementationRuntimeDbBundle?.currentRun?.runtimeState,
    implementationRuntimeDbBundle?.job?.status,
    input.projectId,
    input.taskCursorExecutionV1,
    loadImplementationRuntimeDb,
  ]);

  return {
    implementationRuntimeDbBundle,
    setImplementationRuntimeDbBundle,
    implementationRuntimeDbDiagnostics,
    loadImplementationRuntimeDb,
    applyImplementationRuntimeFetch,
    implementationRuntimePollSuspendedRef: pollSuspendedRef,
  };
}
