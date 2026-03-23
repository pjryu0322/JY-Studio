import test from "node:test";
import assert from "node:assert/strict";
import { classifyFailure } from "@/lib/execution/failureClassifier";
import { FAILURE_TYPES } from "@/lib/execution/failureTypes";

test.describe("classifyFailure", () => {
  test("cursor 실패 -> CURSOR_EXECUTION_FAILED (confidence >= 0.8)", () => {
    const res = classifyFailure({
      stage: "EXECUTE",
      message: "cursor_execution_failed: executor failed",
      detailJson: { step: "EXECUTE", error: "cursor_execution_failed" },
    });

    assert.equal(res.type, FAILURE_TYPES.CURSOR_EXECUTION_FAILED);
    assert.ok(res.confidence >= 0.8);
  });

  test("git apply 실패 -> GIT_APPLY_FAILED (confidence >= 0.8)", () => {
    const res = classifyFailure({
      stage: "APPLY",
      message: "error: patch failed at line 23",
      detailJson: { step: "APPLY", error: "patch failed" },
    });

    assert.equal(res.type, FAILURE_TYPES.GIT_APPLY_FAILED);
    assert.ok(res.confidence >= 0.8);
  });

  test("git conflict -> GIT_CONFLICT (confidence >= 0.8)", () => {
    const res = classifyFailure({
      stage: "APPLY",
      message: "fatal: merge conflict",
      detailJson: { step: "APPLY", error: "fatal: merge conflict" },
    });

    assert.equal(res.type, FAILURE_TYPES.GIT_CONFLICT);
    assert.ok(res.confidence >= 0.8);
  });

  test("PR 생성 실패 -> PR_CREATION_FAILED (confidence >= 0.8)", () => {
    const res = classifyFailure({
      stage: "PR",
      message: "Failed to create pull request",
      detailJson: { step: "PR", error: "pull request failed" },
    });

    assert.equal(res.type, FAILURE_TYPES.PR_CREATION_FAILED);
    assert.ok(res.confidence >= 0.8);
  });

  test("network error -> NETWORK_ERROR (confidence >= 0.8)", () => {
    const res = classifyFailure({
      stage: "EXECUTE",
      message: "network error: connection refused",
      detailJson: { step: "EXECUTE", error: "connection refused" },
    });

    assert.equal(res.type, FAILURE_TYPES.NETWORK_ERROR);
    assert.ok(res.confidence >= 0.8);
  });

  test("auth error -> AUTH_ERROR (confidence >= 0.8)", () => {
    const res = classifyFailure({
      stage: "PR",
      message: "403 forbidden",
      detailJson: { step: "PR", error: "403 forbidden" },
    });

    // AUTH_ERROR should be higher priority than PR_CREATION_FAILED
    assert.equal(res.type, FAILURE_TYPES.AUTH_ERROR);
    assert.ok(res.confidence >= 0.8);
  });

  test("detailJson only -> NETWORK_ERROR", () => {
    const res = classifyFailure({
      stage: "EXECUTE",
      message: null,
      detailJson: { rawError: "timeout while connecting to executor" },
    });

    assert.equal(res.type, FAILURE_TYPES.NETWORK_ERROR);
    assert.ok(res.confidence >= 0.8);
  });

  test("unknown fallback -> UNKNOWN (confidence === 0.2)", () => {
    const res = classifyFailure({
      stage: "COMPLETE",
      message: "unexpected issue occurred",
      detailJson: { step: "COMPLETE", error: "unexpected issue occurred" },
    });

    assert.equal(res.type, FAILURE_TYPES.UNKNOWN);
    assert.equal(res.confidence, 0.2);
  });
});

