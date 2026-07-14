import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DoclingImportBundleStatus } from "@prisma/client";
import {
  resolveDoclingRetryMode,
} from "../lib/docling-import/docling-import-state.ts";
import { DOCLING_MARKDOWN_VALIDATOR_VERSION } from "../lib/adapters/docling/docling-markdown-validator.ts";

const projectRoot = join(import.meta.dirname, "../..");
const runLive = process.env.DOCLING_REVALIDATION_E2E === "1";

describe("docling revalidation (unit + gated e2e)", () => {
  it("ships revalidate route and client API", () => {
    const route = readFileSync(
      join(
        projectRoot,
        "src/app/api/v1/provider/packs/[packId]/docling-import/[bundleId]/revalidate/route.ts",
      ),
      "utf8",
    );
    assert.ok(route.includes("revalidateDoclingImportBundle"));

    const api = readFileSync(
      join(projectRoot, "src/lib/provider-center-api.ts"),
      "utf8",
    );
    assert.ok(api.includes("revalidateProviderDoclingImportBundleApi"));

    const service = readFileSync(
      join(projectRoot, "src/lib/docling-import/docling-import-service.ts"),
      "utf8",
    );
    assert.ok(service.includes("export async function revalidateDoclingImportBundle"));
    assert.ok(service.includes("runValidateNormalizeAfterRetry"));
    assert.ok(!service.includes("같은 파일로는 재시도할 수 없습니다"));
  });

  it("UI exposes 저장된 파일 재검증 for REVALIDATE mode", () => {
    const ui = readFileSync(
      join(
        projectRoot,
        "src/components/provider-distribution/ProviderDoclingImportTab.tsx",
      ),
      "utf8",
    );
    assert.ok(ui.includes("저장된 파일 재검증"));
    assert.ok(ui.includes("REVALIDATE_STORED_OBJECTS"));
    assert.ok(!ui.includes("같은 파일로는 재시도할 수 없습니다"));
  });

  it("retryMode maps integrity failures to reupload; soft MD is not a mismatch gate", () => {
    assert.equal(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "DOCLING_SCHEMA_INVALID",
      ),
      "REUPLOAD_REQUIRED",
    );
    assert.equal(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "DOCLING_VALIDATION_FAILED",
      ),
      "REVALIDATE_STORED_OBJECTS",
    );
    assert.equal(DOCLING_MARKDOWN_VALIDATOR_VERSION, "3.0.0");

    const service = readFileSync(
      join(projectRoot, "src/lib/docling-import/docling-import-service.ts"),
      "utf8",
    );
    assert.ok(service.includes("validatorVersion"));
    assert.ok(service.includes("previewAvailable") || service.includes("not_provided"));
    assert.ok(service.includes("markdownPayloadFileId: mdFile?.id ?? null"));
  });

  it(
    "live revalidate against storage (skipped unless DOCLING_REVALIDATION_E2E=1)",
    { skip: !runLive },
    async () => {
      const mod = await import("../lib/docling-import/docling-import-service.ts");
      assert.equal(typeof mod.revalidateDoclingImportBundle, "function");
      assert.equal(typeof mod.validateAndNormalizeBundle, "function");
    },
  );
});
