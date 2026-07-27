import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import {
  buildZipExclusionPolicy,
  evaluateZipEntryExclusion,
  matchAdminPreflightExcludePath,
  zipExclusionReasonLabel,
} from "../lib/python-worker/zip-exclusion-policy.ts";
import { buildZipPreflightInventory } from "../lib/python-worker/zip-preflight-inventory.ts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

describe("zip exclusion policy (사전정리)", () => {
  it("flags excluded extensions, directories, names, and oversized files", () => {
    const policy = buildZipExclusionPolicy();
    assert.equal(evaluateZipEntryExclusion(policy, "docs/a.html", 100)?.reason, undefined);
    assert.equal(evaluateZipEntryExclusion(policy, "bin/tool.exe", 10)?.reason, "excluded_extension");
    assert.equal(
      evaluateZipEntryExclusion(policy, "node_modules/pkg/index.js", 10)?.reason,
      "excluded_directory",
    );
    assert.equal(evaluateZipEntryExclusion(policy, "docs/.DS_Store", 10)?.reason, "excluded_file_name");
    assert.equal(
      evaluateZipEntryExclusion(policy, "docs/huge.bin", 60 * 1024 * 1024)?.reason,
      "excluded_extension",
    );
    assert.equal(
      evaluateZipEntryExclusion(policy, "docs/huge.pdf", 60 * 1024 * 1024)?.reason,
      "file_size_exceeded",
    );
    assert.equal(zipExclusionReasonLabel("excluded_extension"), "제외 확장자");
  });

  it("matches Admin 사전정리 path exclusions (exact and nested)", () => {
    assert.equal(matchAdminPreflightExcludePath("Docs/a.html", ["Docs/a.html"]), "Docs/a.html");
    assert.equal(matchAdminPreflightExcludePath("Samples/x.js", ["Samples"]), "Samples");
    assert.equal(matchAdminPreflightExcludePath("Docs/a.html", ["Samples"]), null);
    assert.equal(zipExclusionReasonLabel("admin_preflight_excluded"), "사전정리 제외");
  });
});

describe("zip preflight inventory", () => {
  it("lists files/folders with exclusion candidates", async () => {
    const zip = new JSZip();
    zip.folder("docs");
    zip.file("docs/guide.html", "<html></html>");
    zip.file("bin/setup.exe", "MZ");
    zip.folder("node_modules/x");
    zip.file("node_modules/x/index.js", "module.exports=1");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const inventory = await buildZipPreflightInventory(bytes, {
      originalFileName: "sample.zip",
    });
    assert.equal(inventory.originalFileName, "sample.zip");
    assert.ok(inventory.fileCount >= 3);
    assert.ok(inventory.folderCount >= 1);
    const exe = inventory.entries.find((e) => e.path.endsWith("setup.exe"));
    assert.ok(exe);
    assert.equal(exe!.exclusionCandidate, true);
    assert.equal(exe!.exclusionReason, "excluded_extension");
    assert.equal(exe!.extension, ".exe");
    const nested = inventory.entries.find((e) => e.path.includes("node_modules") && e.kind === "file");
    assert.ok(nested);
    assert.equal(nested!.exclusionCandidate, true);
    assert.equal(nested!.exclusionReason, "excluded_directory");
  });
});

describe("admin 사전정리 UX wiring", () => {
  it("exposes preflight column, dialog, and admin API route", () => {
    const inbox = readFileSync(
      join(projectRoot, "src/components/AdminWorkInboxPageClient.tsx"),
      "utf8",
    );
    const dialog = readFileSync(
      join(projectRoot, "src/components/AdminZipPreflightInventoryDialog.tsx"),
      "utf8",
    );
    const route = readFileSync(
      join(projectRoot, "src/app/api/v1/admin/packs/[packId]/worker-zip/preflight/route.ts"),
      "utf8",
    );
    const api = readFileSync(join(projectRoot, "src/lib/admin-review-api.ts"), "utf8");
    assert.ok(inbox.includes("사전정리"));
    assert.ok(inbox.includes("AdminZipPreflightInventoryPanel"));
    assert.ok(inbox.includes("PreflightInventoryIcon"));
    assert.ok(inbox.includes("GenerationCreateIcon"));
    assert.ok(inbox.includes("setSelectedPreflightPack(null)"));
    assert.ok(inbox.includes("ADMIN_WORK_GENERATION_TARGETS_TITLE"));
    assert.ok(inbox.includes("preflightCollapsed"));
    assert.ok(inbox.includes("setPreflightCollapsed(true)"));
    assert.ok(!inbox.includes("autoStartGeneration"));
    assert.ok(!inbox.includes("generationSessionKey"));
    assert.ok(inbox.includes("접수일"));
    assert.ok(inbox.includes("formatInboxDate"));
    assert.ok(!inbox.includes("접수일자"));
    const card = readFileSync(
      join(projectRoot, "src/components/AdminWorkerZipGenerationCard.tsx"),
      "utf8",
    );
    assert.ok(card.includes("admin_preflight_excluded"));
    assert.ok(!card.includes("|| generationDone)"));
    const genService = readFileSync(
      join(projectRoot, "src/lib/python-worker/worker-zip-import-provider-service.ts"),
      "utf8",
    );
    assert.ok(genService.includes("adminExcludePaths"));
    assert.ok(genService.includes("adminPreflightExclusions"));
    const runner = readFileSync(
      join(projectRoot, "src/lib/python-worker/python-worker-runner.ts"),
      "utf8",
    );
    assert.ok(runner.includes("adminExcludePaths"));
    assert.ok(runner.includes("--options-json"));
    assert.ok(dialog.includes("제외 대상") || dialog.includes("제외 선택"));
    assert.ok(dialog.includes("AdminPanelIconButton"));
    assert.ok(dialog.includes("AdminPanelCollapseIcon"));
    assert.ok(dialog.includes("AdminPanelRefreshIcon"));
    assert.ok(dialog.includes("AdminPanelDownloadIcon"));
    assert.ok(dialog.includes("제외사유"));
    assert.ok(dialog.includes("collectSubtreePaths"));
    assert.ok(dialog.includes("buildPreflightInventoryXlsx"));
    assert.ok(!dialog.includes(">닫기<") && !dialog.includes("닫기</button>"));
    const toolbar = readFileSync(
      join(projectRoot, "src/components/AdminPanelToolbarIcons.tsx"),
      "utf8",
    );
    assert.ok(toolbar.includes("AdminPanelIconButton"));
    assert.ok(toolbar.includes("AdminPanelCollapseIcon"));
    const runs = readFileSync(
      join(projectRoot, "src/components/AdminWorkerZipRunsPanel.tsx"),
      "utf8",
    );
    assert.ok(runs.includes("AdminPanelIconButton"));
    assert.ok(runs.includes("AdminPanelRefreshIcon"));
    const genCard = readFileSync(
      join(projectRoot, "src/components/AdminWorkerZipGenerationCard.tsx"),
      "utf8",
    );
    assert.ok(genCard.includes("AdminPanelCollapseIcon"));
    assert.ok(!genCard.includes("▸"));
    assert.ok(dialog.includes('type="checkbox"'));
    assert.ok(dialog.includes("saveAdminWorkerZipPreflightExclusions"));
    assert.ok(dialog.includes("fetchAdminWorkerZipPreflight"));
    assert.ok(!dialog.includes("fixed inset-0"));
    assert.ok(route.includes("getAdminWorkerZipPreflightInventory"));
    assert.ok(route.includes("saveAdminWorkerZipPreflightExclusions"));
    assert.ok(route.includes("export async function PUT"));
    assert.ok(route.includes("items"));
    assert.ok(route.includes("requireAdminSession"));
    assert.ok(api.includes("fetchAdminWorkerZipPreflight"));
    assert.ok(api.includes("saveAdminWorkerZipPreflightExclusions"));
    assert.ok(api.includes("savedExcludedReasons"));
  });
});

describe("zip preflight export helpers", () => {
  it("collects folder subtree paths and builds xlsx bytes", async () => {
    const { collectSubtreePaths, buildPreflightInventoryXlsx } = await import(
      "../lib/python-worker/zip-preflight-export.ts"
    );
    const entries = [
      { path: "Docs" },
      { path: "Docs/api/a.html" },
      { path: "Samples/x.js" },
    ];
    assert.deepEqual(collectSubtreePaths(entries, "Docs"), ["Docs", "Docs/api/a.html"]);
    const bytes = await buildPreflightInventoryXlsx([
      {
        path: "Docs/a.html",
        kind: "file",
        extension: ".html",
        sizeBytes: 12,
        excluded: true,
        exclusionReason: "테스트",
        exclusionTargetLabel: "",
      },
    ]);
    assert.ok(bytes.byteLength > 100);
    // PK zip header
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4b);
  });
});
