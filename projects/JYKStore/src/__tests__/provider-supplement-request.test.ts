import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAdminSupplementAvailableActions,
  buildAdminSupplementQueueDisplay,
  buildAdminSupplementRequestViewModel,
  buildInitialProviderSupplementState,
  buildProviderSupplementRequestViewModel,
  encodeProviderSupplementRequestState,
  parseProviderSupplementRequestState,
  resolveSupplementHandlingHint,
} from "../lib/provider-supplement-request.ts";

describe("provider supplement request view models", () => {
  it("builds waiting-for-admin provider UX without materials primary CTA", () => {
    const state = buildInitialProviderSupplementState({
      changesRequest: {
        changeType: "CHUNKING",
        targetKind: "CHUNK",
        targetLabel: "chunk-1",
        details: "청킹이 부적절합니다.",
      },
      clientId: "c1",
    });
    const vm = buildProviderSupplementRequestViewModel(state);
    assert.ok(vm);
    assert.equal(vm!.displayStatus, "보완요청 제출됨");
    assert.equal(vm!.adminProcessingState, "접수 대기");
    assert.equal(vm!.canEditSource, false);
    assert.equal(vm!.showMaterialsLink, false);
    assert.ok(vm!.primaryActions.some((a) => a.id === "view_request"));
    assert.ok(vm!.primaryActions.every((a) => a.id !== "go_materials"));
    assert.ok(vm!.secondaryActions.some((a) => a.id === "withdraw"));
  });

  it("maps admin PENDING to 보완요청 접수 대기 waiting", () => {
    const display = buildAdminSupplementQueueDisplay("PENDING");
    assert.equal(display.displayStatus, "보완요청 접수 대기");
    assert.equal(display.ctaLabel, "요청사항 확인");
    assert.equal(display.isWaitingForAdmin, true);
  });

  it("gates admin actions by phase and classifies handling owner", () => {
    assert.deepEqual(buildAdminSupplementAvailableActions("PENDING"), ["ACCEPT"]);
    assert.ok(
      buildAdminSupplementAvailableActions("ACCEPTED").includes("ADMIN_FIX"),
    );
    assert.ok(
      buildAdminSupplementAvailableActions("RESOLVED").includes(
        "REQUEST_PROVIDER_REVIEW_AGAIN",
      ),
    );

    const missingHint = resolveSupplementHandlingHint("MISSING");
    assert.equal(missingHint.owner, "PROVIDER");
    const chunkHint = resolveSupplementHandlingHint("CHUNKING");
    assert.equal(chunkHint.owner, "ADMIN");

    const state = buildInitialProviderSupplementState({
      changesRequest: {
        changeType: "CHUNKING",
        targetKind: "CHUNK",
        targetLabel: "chunk-9",
        details: "청크가 잘못 잘렸습니다.",
      },
      clientId: "c1",
    });
    const vm = buildAdminSupplementRequestViewModel(state);
    assert.equal(vm.adminQueueGroup, "PROVIDER_SUPPLEMENT_REQUIRED");
    assert.equal(vm.issueCount, 1);
    assert.match(vm.details, /청크/);
    assert.deepEqual(vm.availableActions, ["ACCEPT"]);
  });

  it("round-trips supplement state JSON", () => {
    const state = buildInitialProviderSupplementState({
      changesRequest: {
        changeType: "OTHER",
        targetKind: "OTHER",
        details: "보완이 필요합니다.",
      },
      clientId: "c1",
    });
    const encoded = encodeProviderSupplementRequestState(state);
    const parsed = parseProviderSupplementRequestState(encoded);
    assert.ok(parsed);
    assert.equal(parsed!.details, "보완이 필요합니다.");
    assert.equal(parsed!.adminPhase, "PENDING");
  });
});
