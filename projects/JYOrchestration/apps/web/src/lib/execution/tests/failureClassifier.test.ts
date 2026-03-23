import test from "node:test";
import assert from "node:assert/strict";
import { classifyFailure } from "@/lib/execution/failureClassifier";
import { FAILURE_TYPES } from "@/lib/execution/failureTypes";

test("cursor failure -> CURSOR_EXECUTION_FAILED", () => {
  const res = classifyFailure({
    stage: "EXECUTE",
    message: "cursor_execution_failed: simulated",
    detailJson: { step: "EXECUTE", error: "cursor_execution_failed" },
  });
  assert.equal(res.type, FAILURE_TYPES.CURSOR_EXECUTION_FAILED);
});

test("git apply failure -> GIT_APPLY_FAILED", () => {
  const res = classifyFailure({
    stage: "APPLY",
    message: "error: patch failed at line 23",
    detailJson: { step: "APPLY", error: "patch failed" },
  });
  assert.equal(res.type, FAILURE_TYPES.GIT_APPLY_FAILED);
});

test("git conflict -> GIT_CONFLICT", () => {
  const res = classifyFailure({
    stage: "APPLY",
    message: "fatal: merge conflict",
    detailJson: { step: "APPLY", error: "fatal: merge conflict" },
  });
  assert.equal(res.type, FAILURE_TYPES.GIT_CONFLICT);
});

test("pr creation failure -> PR_CREATION_FAILED", () => {
  const res = classifyFailure({
    stage: "PR",
    message: "Failed to create pull request: 500 - pull request failed",
    detailJson: { step: "PR", error: "pull request failed" },
  });
  assert.equal(res.type, FAILURE_TYPES.PR_CREATION_FAILED);
});

test("network error -> NETWORK_ERROR", () => {
  const res = classifyFailure({
    stage: "EXECUTE",
    message: "timeout while fetching (network error)",
    detailJson: { step: "EXECUTE", error: "timeout" },
  });
  assert.equal(res.type, FAILURE_TYPES.NETWORK_ERROR);
});

test("unknown failure -> UNKNOWN", () => {
  const res = classifyFailure({
    stage: "EXECUTE",
    message: "some random error",
    detailJson: { step: "EXECUTE", error: "some random error" },
  });
  assert.equal(res.type, FAILURE_TYPES.UNKNOWN);
});

