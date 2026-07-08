import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StructureQualityGateSnapshot } from "@/lib/structure-quality/structure-quality-readiness";
import { meetsStructureQualityGate } from "@/lib/structure-quality/structure-quality-readiness";

function snap(
  partial: Partial<StructureQualityGateSnapshot> &
    Pick<StructureQualityGateSnapshot, "freshnessStatus">,
): StructureQualityGateSnapshot {
  return {
    structureCoverageStatus: partial.structureCoverageStatus ?? "PASS",
    knowledgeQualityStatus: partial.knowledgeQualityStatus ?? "PASS",
    freshnessStatus: partial.freshnessStatus,
  };
}

describe("structure quality readiness gate", () => {
  it("blocks when freshness is MISSING", () => {
    assert.equal(meetsStructureQualityGate(snap({ freshnessStatus: "MISSING" })), false);
  });

  it("blocks when freshness is STALE", () => {
    assert.equal(meetsStructureQualityGate(snap({ freshnessStatus: "STALE" })), false);
  });

  it("allows CURRENT with PASS/PASS", () => {
    assert.equal(
      meetsStructureQualityGate(
        snap({
          freshnessStatus: "CURRENT",
          structureCoverageStatus: "PASS",
          knowledgeQualityStatus: "PASS",
        }),
      ),
      true,
    );
  });

  it("allows CURRENT with WARNING/PASS", () => {
    assert.equal(
      meetsStructureQualityGate(
        snap({
          freshnessStatus: "CURRENT",
          structureCoverageStatus: "WARNING",
          knowledgeQualityStatus: "PASS",
        }),
      ),
      true,
    );
  });

  it("blocks CURRENT with FAIL/PASS", () => {
    assert.equal(
      meetsStructureQualityGate(
        snap({
          freshnessStatus: "CURRENT",
          structureCoverageStatus: "FAIL",
          knowledgeQualityStatus: "PASS",
        }),
      ),
      false,
    );
  });

  it("blocks CURRENT with PASS/FAIL", () => {
    assert.equal(
      meetsStructureQualityGate(
        snap({
          freshnessStatus: "CURRENT",
          structureCoverageStatus: "PASS",
          knowledgeQualityStatus: "FAIL",
        }),
      ),
      false,
    );
  });
});
