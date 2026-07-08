import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RetrievalEvaluationGateSnapshot } from "@/lib/retrieval-evaluation/retrieval-evaluation-readiness";
import { meetsRetrievalEvaluationGate } from "@/lib/retrieval-evaluation/retrieval-evaluation-readiness";

function snap(
  partial: Partial<RetrievalEvaluationGateSnapshot> &
    Pick<RetrievalEvaluationGateSnapshot, "freshnessStatus">,
): RetrievalEvaluationGateSnapshot {
  return {
    reportStatus: partial.reportStatus ?? "PASS",
    freshnessStatus: partial.freshnessStatus,
  };
}

describe("retrieval evaluation readiness gate", () => {
  it("blocks MISSING", () => {
    assert.equal(
      meetsRetrievalEvaluationGate(snap({ freshnessStatus: "MISSING", reportStatus: null })),
      false,
    );
  });

  it("blocks STALE", () => {
    assert.equal(meetsRetrievalEvaluationGate(snap({ freshnessStatus: "STALE" })), false);
  });

  it("allows CURRENT + PASS", () => {
    assert.equal(
      meetsRetrievalEvaluationGate(snap({ freshnessStatus: "CURRENT", reportStatus: "PASS" })),
      true,
    );
  });

  it("allows CURRENT + WARNING", () => {
    assert.equal(
      meetsRetrievalEvaluationGate(
        snap({ freshnessStatus: "CURRENT", reportStatus: "WARNING" }),
      ),
      true,
    );
  });

  it("blocks CURRENT + FAIL", () => {
    assert.equal(
      meetsRetrievalEvaluationGate(snap({ freshnessStatus: "CURRENT", reportStatus: "FAIL" })),
      false,
    );
  });
});
