import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isProviderPackContentEditable,
  isProviderRejectionAcknowledged,
  withProviderRejectionAcknowledged,
} from "../lib/pack-review-rejection-ack.ts";

describe("pack review rejection acknowledgment", () => {
  it("locks editing while rejection is unacknowledged", () => {
    assert.equal(
      isProviderPackContentEditable({
        status: "DRAFT",
        latestRejectionReason: "보완 필요",
        latestRejectionAcknowledged: false,
      }),
      false,
    );
    assert.equal(
      isProviderPackContentEditable({
        status: "DRAFT",
        latestRejectionReason: "보완 필요",
        latestRejectionAcknowledged: true,
      }),
      true,
    );
    assert.equal(
      isProviderPackContentEditable({
        status: "REVIEWING",
        latestRejectionReason: null,
        latestRejectionAcknowledged: true,
      }),
      false,
    );
  });

  it("locks editing while an open PackReview exists", () => {
    assert.equal(
      isProviderPackContentEditable({
        status: "DRAFT",
        latestReviewStatus: "PENDING",
      }),
      false,
    );
    assert.equal(
      isProviderPackContentEditable({
        status: "DRAFT",
        latestReviewStatus: "IN_REVIEW",
      }),
      false,
    );
    assert.equal(
      isProviderPackContentEditable({
        status: "DRAFT",
        latestReviewStatus: null,
      }),
      true,
    );
  });

  it("locks DRAFT editing while admin generation hold is active", () => {
    assert.equal(
      isProviderPackContentEditable({
        status: "DRAFT",
        adminGenerationHold: "ACCEPTED",
      }),
      false,
    );
    assert.equal(
      isProviderPackContentEditable({
        status: "DRAFT",
        adminGenerationHold: "PROCESSING",
      }),
      false,
    );
    assert.equal(
      isProviderPackContentEditable({
        status: "DRAFT",
        adminGenerationHold: "COMPLETED",
      }),
      false,
    );
    assert.equal(
      isProviderPackContentEditable({
        status: "DRAFT",
        adminGenerationHold: null,
      }),
      true,
    );
  });

  it("stores acknowledgment on submitSnapshot without schema change", () => {
    const next = withProviderRejectionAcknowledged({ foo: 1 }, {
      acknowledgedAt: "2026-07-23T00:00:00.000Z",
      acknowledgedByUserId: "u1",
    });
    assert.equal(next.foo, 1);
    assert.equal(isProviderRejectionAcknowledged(next), true);
    assert.equal(isProviderRejectionAcknowledged({}), false);
  });
});
