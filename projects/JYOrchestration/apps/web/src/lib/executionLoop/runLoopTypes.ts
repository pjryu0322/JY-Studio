/** Relay 실행 루프 — 단계 기록 및 결과 타입 */

import type { NextTaskReadinessResult } from "@/lib/executionLoop/nextTaskReadiness";

export type LoopStepRecord =
  | { phase: "picked"; taskId: string }
  | { phase: "cursor"; taskId: string; ok: boolean; runId?: string; error?: string }
  | {
      phase: "git_reflection_gate";
      taskId: string;
      runId?: string;
      branch?: string | null;
      commitHash: string | null;
      changedFileCount: number;
      passed: boolean;
      reason: string;
    }
  | {
      phase: "stage1_smoke";
      taskId: string;
      runId?: string;
      branch?: string | null;
      commitHash: string | null;
      changedFileCount: number;
      passed: boolean;
      reason: string;
    }
  | { phase: "evaluate"; taskId: string; verdict: string; summary: string }
  | { phase: "stop"; reason: string };

export type RunExecutionLoopResult = {
  ok: boolean;
  steps: LoopStepRecord[];
  message: string;
  /** ENV_TEST 등에서 PR_OPENED 직후 다음 Task 준비도 함께 계산할 때 */
  nextTaskReadiness?: NextTaskReadinessResult;
};
