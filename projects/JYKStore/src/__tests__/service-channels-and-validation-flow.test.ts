import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertServiceChannelEnabled,
  isServiceEnded,
  selectedServiceChannels,
} from "../lib/distribution/service-channel-policy.ts";
import {
  resolveDefaultProviderPackTab,
  resolveProviderPackTabLocks,
} from "../lib/provider-pack-tabs.ts";
import { isDistributionReadyForServiceValidation } from "../lib/distribution/service-validation-service.ts";

describe("service-channel-policy", () => {
  it("requires at least one selected channel", () => {
    assert.deepEqual(
      selectedServiceChannels({ allowApi: false, allowMcp: false, allowDownload: false }),
      [],
    );
    assert.deepEqual(
      selectedServiceChannels({ allowApi: true, allowMcp: false, allowDownload: true }),
      ["API", "DOWNLOAD"],
    );
  });

  it("blocks ended services", () => {
    assert.equal(isServiceEnded(new Date(Date.now() - 60_000)), true);
    assert.equal(isServiceEnded(null), false);
    const check = assertServiceChannelEnabled("API", {
      allowApi: true,
      allowMcp: true,
      allowDownload: true,
      serviceEndsAt: new Date(Date.now() - 1_000),
    });
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.code, "SERVICE_ENDED");
  });

  it("blocks disabled API channel", () => {
    const check = assertServiceChannelEnabled("API", {
      allowApi: false,
      allowMcp: true,
      allowDownload: true,
      serviceEndsAt: null,
    });
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.code, "SERVICE_CHANNEL_DISABLED");
  });
});

describe("provider pack tabs service validation flow", () => {
  it("defaults to serviceValidation after distribution is ready", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 1,
        hasPayload: true,
        providerConfirmed: true,
        knowledgePassed: true,
        hasDistribution: true,
        serviceValidationPassed: false,
      }),
      "serviceValidation",
    );
  });

  it("locks review until service validation passes", () => {
    const locks = resolveProviderPackTabLocks({
      providerConfirmed: true,
      knowledgePassed: true,
      distributionReady: true,
      serviceValidationPassed: false,
    });
    assert.equal(locks.serviceValidation.locked, false);
    assert.equal(locks.review.locked, true);
  });
});

describe("distribution readiness for service validation", () => {
  it("requires source, rights, and channel", () => {
    assert.equal(
      isDistributionReadyForServiceValidation({
        sourceTitle: "Doc",
        rightsBasis: "PUBLIC_LICENSE",
        rightsConfirmedAt: new Date().toISOString(),
        allowApi: true,
        allowMcp: false,
        allowDownload: false,
      }),
      true,
    );
    assert.equal(
      isDistributionReadyForServiceValidation({
        sourceTitle: "Doc",
        rightsBasis: "PUBLIC_LICENSE",
        rightsConfirmedAt: null,
        allowApi: true,
        allowMcp: false,
        allowDownload: false,
      }),
      false,
    );
  });
});
