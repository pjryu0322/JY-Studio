import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  availableActionsForTarget,
  buildWorkbenchSummary,
  nextWorkForCase,
} from "@/lib/correction/correction-mapper";
import {
  actionUiLabel,
  canRunPrimaryApply,
  CORRECTION_WORKBENCH_GRID_CLASS,
  filterCorrectionCases,
  outcomeUiLabel,
  resolveSelectedCorrectionCase,
  severityUiLabel,
  shouldShowAdvancedDetails,
  shouldShowMoreMenu,
  splitCorrectionActions,
  statusUiLabel,
} from "@/lib/correction/correction-ui-labels";
import { CorrectionServiceError } from "@/lib/correction/correction-types";
import type { AdminCorrectionCase } from "@/lib/admin-review-api";
import {
  applyTooltipEvent,
  createTooltipState,
} from "@/lib/ui/tooltip-state";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function makeCase(
  overrides: Partial<AdminCorrectionCase> & Pick<AdminCorrectionCase, "id" | "severity" | "status">,
): AdminCorrectionCase {
  return {
    packId: "pack-1",
    versionId: "ver-1",
    targetType: "CHUNK",
    targetId: "t1",
    secondaryTargetId: null,
    title: "케이스",
    description: "설명",
    sourceLocation: null,
    contentPreview: null,
    recommendedAction: "CHUNK_DELETE",
    inventoryItemId: null,
    relativePath: null,
    availableActions: ["CHUNK_DELETE", "CHUNK_MERGE", "FILE_REQUEST_PROVIDER"],
    nextAction: "보정 액션 적용",
    appliedAt: null,
    regeneratedAt: null,
    verifiedAt: null,
    closedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("correction-mapper", () => {
  it("exposes FILE/STRUCTURE/CHUNK actions only (no split/label)", () => {
    assert.deepEqual(availableActionsForTarget("FILE"), [
      "FILE_EXCLUDE",
      "FILE_REQUEST_PROVIDER",
    ]);
    assert.deepEqual(availableActionsForTarget("STRUCTURE"), [
      "STRUCTURE_DELETE",
      "STRUCTURE_MERGE",
    ]);
    assert.deepEqual(availableActionsForTarget("CHUNK"), ["CHUNK_DELETE", "CHUNK_MERGE"]);
  });

  it("maps status to next work labels", () => {
    assert.equal(nextWorkForCase("OPEN"), "보정 액션 적용");
    assert.equal(nextWorkForCase("CLOSED"), "완료");
  });

  it("builds workbench summary counts and next work", () => {
    const now = new Date();
    const summary = buildWorkbenchSummary({
      packId: "pack-1",
      versionId: "ver-1",
      cases: [
        {
          id: "c1",
          packId: "pack-1",
          versionId: "ver-1",
          targetType: "FILE",
          targetId: "t1",
          secondaryTargetId: null,
          issueCode: null,
          severity: "BLOCKER",
          title: "a",
          description: "a",
          sourceLocation: null,
          contentPreview: null,
          recommendedAction: "FILE_EXCLUDE",
          status: "OPEN",
          generationRunId: null,
          searchIndexGenerationId: null,
          inventoryItemId: null,
          relativePath: null,
          parameters: null,
          appliedAt: null,
          appliedByUserId: null,
          regeneratedAt: null,
          verifiedAt: null,
          closedAt: null,
          closedByUserId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    assert.equal(summary.openCount, 1);
    assert.equal(summary.blockerCount, 1);
    assert.equal(summary.currentStatus, "보정 대기");
  });
});

describe("CorrectionServiceError", () => {
  it("carries code and http status", () => {
    const err = new CorrectionServiceError("CASE_NOT_FOUND", "missing", 404);
    assert.equal(err.code, "CASE_NOT_FOUND");
    assert.equal(err.httpStatus, 404);
  });
});

describe("P5.1B correction UI labels (Korean only)", () => {
  it("maps internal codes to Korean UI labels", () => {
    assert.equal(severityUiLabel("BLOCKER"), "차단");
    assert.equal(severityUiLabel("WARNING"), "주의");
    assert.equal(severityUiLabel("BLOCKER", true), "완료");
    assert.equal(statusUiLabel("OPEN"), "미처리");
    assert.equal(statusUiLabel("APPLIED"), "적용");
    assert.equal(statusUiLabel("REGENERATED"), "재생성");
    assert.equal(statusUiLabel("CLOSED"), "완료");
    assert.equal(actionUiLabel("FILE_EXCLUDE"), "제외");
    assert.equal(actionUiLabel("CHUNK_MERGE"), "통합");
    assert.equal(actionUiLabel("STRUCTURE_DELETE"), "삭제");
    assert.equal(outcomeUiLabel("SUCCEEDED"), "성공");
    assert.equal(outcomeUiLabel("CORRECTION_REQUIRED"), "보정 필요");
  });
});

describe("P5.1B correction UX behavior", () => {
  it("selects a case by id and falls back to first filtered", () => {
    const cases = [
      makeCase({ id: "a", severity: "WARNING", status: "OPEN", title: "주의1" }),
      makeCase({ id: "b", severity: "BLOCKER", status: "OPEN", title: "차단1" }),
    ];
    const filtered = filterCorrectionCases(cases, "BLOCKER");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.id, "b");

    const selected = resolveSelectedCorrectionCase({
      cases,
      filtered,
      selectedId: "b",
    });
    assert.equal(selected?.id, "b");

    const fallback = resolveSelectedCorrectionCase({
      cases,
      filtered,
      selectedId: null,
    });
    assert.equal(fallback?.id, "b");
  });

  it("splits primary actions and more menu actions", () => {
    const { primary, more } = splitCorrectionActions([
      "CHUNK_DELETE",
      "CHUNK_MERGE",
      "FILE_REQUEST_PROVIDER",
    ]);
    assert.deepEqual(primary, ["CHUNK_DELETE", "CHUNK_MERGE"]);
    assert.deepEqual(more, ["FILE_REQUEST_PROVIDER"]);
    assert.equal(shouldShowMoreMenu(more, false), false);
    assert.equal(shouldShowMoreMenu(more, true), true);
  });

  it("keeps advanced details behind toggle", () => {
    assert.equal(shouldShowAdvancedDetails(false), false);
    assert.equal(shouldShowAdvancedDetails(true), true);
  });

  it("allows primary apply only for OPEN cases", () => {
    assert.equal(canRunPrimaryApply("OPEN"), true);
    assert.equal(canRunPrimaryApply("APPLIED"), false);
    assert.equal(canRunPrimaryApply("REGENERATED"), false);
  });

  it("keeps mobile/desktop grid class for workbench layout", () => {
    assert.match(CORRECTION_WORKBENCH_GRID_CLASS, /lg:grid-cols-/);
    assert.match(CORRECTION_WORKBENCH_GRID_CLASS, /grid/);
    const panel = readSource("src/components/AdminKnowledgeCorrectionPanel.tsx");
    assert.ok(panel.includes("CORRECTION_WORKBENCH_GRID_CLASS"));
  });
});

describe("P5.1B tooltip accessibility state", () => {
  it("opens on hover, focus, and tap; dismisses correctly", () => {
    let state = createTooltipState();
    state = applyTooltipEvent(state, { type: "hover-enter" });
    assert.deepEqual(state, { open: true, reason: "hover" });
    state = applyTooltipEvent(state, { type: "hover-leave" });
    assert.deepEqual(state, { open: false, reason: null });

    state = applyTooltipEvent(state, { type: "focus" });
    assert.deepEqual(state, { open: true, reason: "focus" });
    state = applyTooltipEvent(state, { type: "blur" });
    assert.deepEqual(state, { open: false, reason: null });

    state = applyTooltipEvent(state, { type: "tap" });
    assert.deepEqual(state, { open: true, reason: "tap" });
    // hover leave must not close sticky tap
    state = applyTooltipEvent(state, { type: "hover-leave" });
    assert.equal(state.open, true);
    state = applyTooltipEvent(state, { type: "tap" });
    assert.deepEqual(state, { open: false, reason: null });

    state = applyTooltipEvent(createTooltipState(), { type: "tap" });
    state = applyTooltipEvent(state, { type: "dismiss" });
    assert.deepEqual(state, { open: false, reason: null });
  });

  it("UiTooltip uses role=tooltip and not native title for tips", () => {
    const tooltip = readSource("src/components/UiTooltip.tsx");
    const panel = readSource("src/components/AdminKnowledgeCorrectionPanel.tsx");
    assert.ok(tooltip.includes('role="tooltip"'));
    assert.ok(tooltip.includes("hover-enter"));
    assert.ok(tooltip.includes("focus"));
    assert.ok(tooltip.includes("tap"));
    assert.ok(panel.includes("UiTooltip"));
    assert.ok(panel.includes("ⓘ"));
    assert.ok(panel.includes("고급 보기"));
    assert.ok(panel.includes("더보기"));
    assert.ok(panel.includes("재생성"));
    assert.ok(panel.includes("제외") || panel.includes("actionUiLabel"));
    // Avoid mixed English chrome labels
    assert.ok(!panel.includes(">Correction<"));
    assert.ok(!panel.includes(">Blocker<"));
    assert.ok(!panel.includes(">Regenerate<"));
    assert.ok(!panel.includes(">More<"));
    // Native title should not be the tip mechanism in the panel
    assert.doesNotMatch(panel, /\stitle="/);
  });
});
