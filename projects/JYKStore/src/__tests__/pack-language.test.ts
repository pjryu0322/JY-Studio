import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  packLanguageDisplayLabel,
  parsePackLanguage,
  toPackLanguageCode,
  toPrismaPackLanguage,
} from "../lib/pack-language.ts";
import {
  buildDoclingBundleReviewSubmitSnapshot,
  parseDoclingBundleReviewSubmitSnapshot,
} from "../lib/distribution/distribution-submit-snapshot.ts";

describe("pack-language helpers", () => {
  it("parses ko/en and null/empty clear", () => {
    assert.deepEqual(parsePackLanguage("ko"), { ok: true, value: "ko" });
    assert.deepEqual(parsePackLanguage("en"), { ok: true, value: "en" });
    assert.deepEqual(parsePackLanguage(null), { ok: true, value: null });
    assert.deepEqual(parsePackLanguage(""), { ok: true, value: null });
    assert.deepEqual(parsePackLanguage("  "), { ok: true, value: null });
  });

  it("rejects KO/EN/kr/ja and other aliases", () => {
    for (const bad of ["KO", "EN", "kr", "ja", "zh", "korean", "eng", 1, true, {}]) {
      const result = parsePackLanguage(bad);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.error, "PACK_LANGUAGE_INVALID");
      }
    }
  });

  it("maps prisma enum codes both ways", () => {
    assert.equal(toPackLanguageCode("KO"), "ko");
    assert.equal(toPackLanguageCode("EN"), "en");
    assert.equal(toPackLanguageCode(null), null);
    assert.equal(toPrismaPackLanguage("ko"), "KO");
    assert.equal(toPrismaPackLanguage("en"), "EN");
    assert.equal(toPrismaPackLanguage(null), null);
  });

  it("exposes display labels", () => {
    assert.equal(packLanguageDisplayLabel("ko"), "한국어");
    assert.equal(packLanguageDisplayLabel("en"), "영어");
    assert.equal(packLanguageDisplayLabel(null), "미선택");
  });
});

describe("docling submit snapshot language", () => {
  it("includes language on new snapshots", () => {
    const snap = buildDoclingBundleReviewSubmitSnapshot({
      submittedVersionId: "ver-1",
      doclingBundleId: "bundle-1",
      sourceFileId: "f-source",
      jsonPayloadFileId: "f-json",
      markdownPayloadFileId: null,
      checksums: { source: "a", json: "b", markdown: null },
      doclingSchemaVersion: "1",
      adapterVersion: "1",
      normalizedDocumentId: "nd-1",
      fingerprint: "fp",
      warningCount: 0,
      sourceTitle: "Docs",
      licenseName: "MIT",
      visibility: "PRIVATE",
      allowDownload: true,
      language: "en",
    });
    assert.equal(snap.language, "en");
    const parsed = parseDoclingBundleReviewSubmitSnapshot(snap);
    assert.ok(parsed);
    assert.equal(parsed?.language, "en");
  });

  it("parses legacy snapshots without language as null", () => {
    const legacy = {
      mode: "DOCLING_BUNDLE",
      submittedAt: "2026-07-12T00:00:00.000Z",
      submittedVersionId: "ver-1",
      doclingBundleId: "bundle-1",
      sourceFileId: "f-source",
      jsonPayloadFileId: "f-json",
      markdownPayloadFileId: null,
      checksums: { source: "a", json: "b", markdown: null },
      doclingSchemaVersion: "1",
      adapterVersion: "1",
      normalizedDocumentId: "nd-1",
      fingerprint: "fp",
      warningCount: 0,
      sourceTitle: "Docs",
      licenseName: "MIT",
      visibility: "PRIVATE",
      allowDownload: true,
    };
    const parsed = parseDoclingBundleReviewSubmitSnapshot(legacy);
    assert.ok(parsed);
    assert.equal(parsed?.language, null);
  });

  it("detects language drift only when snapshot has language", async () => {
    const { detectSubmitSnapshotDrift } = await import("../lib/admin-review-decision.ts");
    const baseDetail = {
      versions: [{ id: "ver-1", language: "en" as const }],
      distribution: {
        visibility: "PRIVATE",
        allowDownload: true,
        sourceTitle: "Docs",
        licenseName: "MIT",
      },
      latestReview: {
        submitSnapshot: {
          mode: "DOCLING_BUNDLE" as const,
          submittedAt: "2026-07-12T00:00:00.000Z",
          submittedVersionId: "ver-1",
          doclingBundleId: "bundle-1",
          sourceFileId: "f-source",
          jsonPayloadFileId: "f-json",
          markdownPayloadFileId: null,
          checksums: { source: "a", json: "b", markdown: null },
          doclingSchemaVersion: "1",
          adapterVersion: "1",
          normalizedDocumentId: "nd-1",
          fingerprint: "fp",
          warningCount: 0,
          sourceTitle: "Docs",
          licenseName: "MIT",
          visibility: "PRIVATE",
          allowDownload: true,
          language: "ko" as const,
        },
      },
    };
    const drifted = detectSubmitSnapshotDrift(baseDetail as never);
    assert.equal(drifted.changed, true);
    assert.ok(drifted.reasons.some((r) => r.includes("문서 언어")));

    const legacy = detectSubmitSnapshotDrift({
      ...baseDetail,
      latestReview: {
        submitSnapshot: {
          ...baseDetail.latestReview.submitSnapshot,
          language: null,
        },
      },
    } as never);
    assert.equal(legacy.changed, false);
  });
});
