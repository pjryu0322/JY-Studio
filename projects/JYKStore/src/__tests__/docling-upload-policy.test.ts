import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertBundleWithinPolicy,
  assertFileWithinPolicy,
  assertPartNumberValid,
  computePartCount,
  DOCLING_UPLOAD_HARD_CAPS,
  formatByteSize,
  getDoclingUploadPolicy,
  resolveDoclingUploadPolicy,
  toUploadPolicyDto,
} from "../lib/docling-import/docling-upload-policy.ts";
import { isDoclingImportError } from "../lib/docling-import/docling-import-errors.ts";

describe("docling-upload-policy", () => {
  it("uses documented defaults", () => {
    const policy = getDoclingUploadPolicy({} as NodeJS.ProcessEnv);
    assert.equal(policy.maxSourceBytes, 1_073_741_824);
    assert.equal(policy.maxJsonBytes, 1_073_741_824);
    assert.equal(policy.maxMarkdownBytes, 536_870_912);
    assert.equal(policy.maxBundleBytes, 2_147_483_648);
    assert.equal(policy.multipartPartBytes, 16_777_216);
    assert.equal(policy.multipartConcurrency, 3);
    assert.equal(policy.uploadSessionTtlSeconds, 86_400);
    assert.equal(policy.presignedUrlTtlSeconds, 900);
  });

  it("caps env values to hard limits and raises min part size", () => {
    const { policy, warnings } = resolveDoclingUploadPolicy({
      JYKSTORE_DOCLING_MAX_SOURCE_BYTES: String(20 * 1024 * 1024 * 1024),
      JYKSTORE_DOCLING_MAX_BUNDLE_BYTES: String(50 * 1024 * 1024 * 1024),
      JYKSTORE_DOCLING_MULTIPART_PART_BYTES: String(1024),
    } as NodeJS.ProcessEnv);
    assert.equal(policy.maxSourceBytes, DOCLING_UPLOAD_HARD_CAPS.maxFileBytes);
    assert.equal(policy.maxBundleBytes, DOCLING_UPLOAD_HARD_CAPS.maxBundleBytes);
    assert.equal(policy.multipartPartBytes, DOCLING_UPLOAD_HARD_CAPS.minPartBytes);
    assert.ok(warnings.length >= 2);
  });

  it("assertFileWithinPolicy enforces role limits", () => {
    const policy = getDoclingUploadPolicy({} as NodeJS.ProcessEnv);
    assert.doesNotThrow(() => assertFileWithinPolicy("SOURCE_ORIGINAL", 1024, policy));
    assert.throws(
      () => assertFileWithinPolicy("SOURCE_ORIGINAL", policy.maxSourceBytes + 1, policy),
      (e) => isDoclingImportError(e) && e.code === "DOCLING_FILE_TOO_LARGE",
    );
    assert.throws(
      () => assertBundleWithinPolicy(policy.maxBundleBytes + 1, policy),
      (e) => isDoclingImportError(e) && e.code === "DOCLING_BUNDLE_TOO_LARGE",
    );
  });

  it("validates part numbers and computes part counts", () => {
    assert.doesNotThrow(() => assertPartNumberValid(1));
    assert.doesNotThrow(() => assertPartNumberValid(10_000));
    assert.throws(
      () => assertPartNumberValid(0),
      (e) => isDoclingImportError(e) && e.code === "DOCLING_INVALID_PART_NUMBER",
    );
    assert.equal(computePartCount(16_777_216, 16_777_216), 1);
    assert.equal(computePartCount(16_777_217, 16_777_216), 2);
  });

  it("formats byte sizes and DTO", () => {
    assert.match(formatByteSize(1024), /KiB/);
    const dto = toUploadPolicyDto(getDoclingUploadPolicy({} as NodeJS.ProcessEnv));
    assert.equal(dto.hardCaps.maxPartNumber, 10_000);
    assert.equal(dto.multipartConcurrency, 3);
  });
});
