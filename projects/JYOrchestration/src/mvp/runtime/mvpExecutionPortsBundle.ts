/**
 * MVP — default bundled execution ports (in-memory adapters + shared run/step stores).
 */

import type { MvpExecutionPortsBundle } from "../ports/mvpPorts";
import { mvpDefaultTaskProvider } from "../task/taskService";
import { mvpDefaultPromptProvider } from "../prompt/promptService";
import { mvpDefaultCursorExecutor } from "../cursor/cursorService";
import { mvpDefaultGitVerifier } from "../git/gitService";
import { mvpDefaultReviewEngine } from "../reviewer/reviewerService";
import { mvpInMemoryRunStore, mvpInMemoryStepStore } from "../execution/inMemoryExecutionState";

export function createDefaultMvpExecutionPortsBundle(): MvpExecutionPortsBundle {
  return {
    tasks: mvpDefaultTaskProvider,
    prompt: mvpDefaultPromptProvider,
    cursor: mvpDefaultCursorExecutor,
    git: mvpDefaultGitVerifier,
    review: mvpDefaultReviewEngine,
    runStore: mvpInMemoryRunStore,
    stepStore: mvpInMemoryStepStore,
  };
}

let cached: MvpExecutionPortsBundle | null = null;

/** Singleton bundle used by `executionService` (replace in tests via `mvpSetExecutionPortsBundleForTesting`). */
export function mvpExecutionPortsBundle(): MvpExecutionPortsBundle {
  if (!cached) {
    cached = createDefaultMvpExecutionPortsBundle();
  }
  return cached;
}

export function mvpSetExecutionPortsBundleForTesting(bundle: MvpExecutionPortsBundle | null): void {
  cached = bundle;
}
